const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Message = require('../../src/structures/Message');

describe('Message media download', function () {
    const temporaryDirectories = [];

    afterEach(function () {
        delete global.window;
        for (const directory of temporaryDirectories.splice(0)) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    function createMediaMessage({
        blob,
        onArrayBuffer,
        downloadMedia,
        onCacheDelete,
        onCacheUsage,
        onCollectGarbage,
    }) {
        let cacheUsageCount = 0;
        const serializedId =
            'false_240131655135475@lid_ACA773752D55923CD5C46178E1F6CC08';
        const waMessage = {
            mediaData: { mediaStage: 'INIT' },
            mediaObject: { filehash: 'file-hash' },
            mimetype: 'video/mp4',
            filename: 'video.mp4',
            size: blob.size,
            downloadMedia: downloadMedia || (async () => undefined),
        };
        global.window = {
            WWebJS: {
                arrayBufferToBase64Async: async (arrayBuffer) => {
                    onArrayBuffer?.(arrayBuffer);
                    return Buffer.from(arrayBuffer).toString('base64');
                },
            },
            require(moduleName) {
                if (moduleName === 'WAWebCollections') {
                    return {
                        Msg: {
                            get(messageId) {
                                expect(messageId).to.equal(serializedId);
                                return waMessage;
                            },
                        },
                    };
                }
                if (moduleName === 'WAWebMediaInMemoryBlobCache') {
                    return {
                        InMemoryMediaBlobCache: {
                            get(filehash) {
                                expect(filehash).to.equal('file-hash');
                                return blob;
                            },
                            delete(filehash) {
                                expect(filehash).to.equal('file-hash');
                                onCacheDelete?.(filehash);
                            },
                            increaseUsageCount(filehash) {
                                expect(filehash).to.equal('file-hash');
                                cacheUsageCount += 1;
                                onCacheUsage?.('increase', cacheUsageCount);
                            },
                            decreaseUsageCount(filehash) {
                                expect(filehash).to.equal('file-hash');
                                cacheUsageCount -= 1;
                                onCacheUsage?.('decrease', cacheUsageCount);
                            },
                            $6(filehash) {
                                expect(filehash).to.equal('file-hash');
                                return cacheUsageCount;
                            },
                        },
                    };
                }
                throw new Error(`Unexpected module: ${moduleName}`);
            },
        };

        const client = {
            pupPage: {
                evaluate: async (callback, ...args) => callback(...args),
                createCDPSession: async () => ({
                    send: async (method) => onCollectGarbage?.(method),
                    detach: async () => undefined,
                }),
            },
        };
        return new Message(client, {
            id: {
                fromMe: false,
                remote: '240131655135475@lid',
                id: 'ACA773752D55923CD5C46178E1F6CC08',
                $1: serializedId,
            },
            directPath: '/media.enc',
            type: 'video',
        });
    }

    it('downloads media for a modern LID message key from the resolved blob cache', async function () {
        const serializedId =
            'false_240131655135475@lid_ACA773752D55923CD5C46178E1F6CC08';
        const blob = new Blob([Buffer.from('hello')]);
        const waMessage = {
            mediaData: { mediaStage: 'INIT' },
            mediaObject: { filehash: 'file-hash' },
            mimetype: 'image/jpeg',
            filename: 'photo.jpg',
            size: 5,
            downloadMedia: async () => undefined,
        };
        global.window = {
            WWebJS: {
                arrayBufferToBase64Async: async (arrayBuffer) =>
                    Buffer.from(arrayBuffer).toString('base64'),
            },
            require(moduleName) {
                if (moduleName === 'WAWebCollections') {
                    return {
                        Msg: {
                            get(messageId) {
                                expect(messageId).to.equal(serializedId);
                                return waMessage;
                            },
                        },
                    };
                }
                if (moduleName === 'WAWebMediaInMemoryBlobCache') {
                    return {
                        InMemoryMediaBlobCache: {
                            get(filehash) {
                                expect(filehash).to.equal('file-hash');
                                return blob;
                            },
                        },
                    };
                }
                throw new Error(`Unexpected module: ${moduleName}`);
            },
        };

        const client = {
            pupPage: {
                evaluate: async (callback, ...args) => callback(...args),
            },
        };
        const message = new Message(client, {
            id: {
                fromMe: false,
                remote: '240131655135475@lid',
                id: 'ACA773752D55923CD5C46178E1F6CC08',
                $1: serializedId,
            },
            directPath: '/media.enc',
            type: 'image',
        });

        const media = await message.downloadMedia();

        expect(media.data).to.equal('aGVsbG8=');
        expect(media.mimetype).to.equal('image/jpeg');
        expect(media.filename).to.equal('photo.jpg');
        expect(media.filesize).to.equal(5);
    });

    it('writes media to a file in bounded chunks without returning media bytes', async function () {
        const chunkSize = 512 * 1024;
        const payload = Buffer.alloc(chunkSize + 17);
        for (let index = 0; index < payload.length; index += 1) {
            payload[index] = index % 251;
        }
        const transferredSizes = [];
        const message = createMediaMessage({
            blob: new Blob([payload]),
            onArrayBuffer: (arrayBuffer) =>
                transferredSizes.push(arrayBuffer.byteLength),
        });
        const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), 'wwebjs-media-file-'),
        );
        temporaryDirectories.push(directory);
        const destination = path.join(directory, 'video.mp4');

        const result = await message.downloadMediaToFile(destination);

        expect(fs.readFileSync(destination).equals(payload)).to.equal(true);
        expect(transferredSizes).to.deep.equal([chunkSize, 17]);
        expect(result).to.deep.equal({
            path: destination,
            mimetype: 'video/mp4',
            filename: 'video.mp4',
            filesize: payload.length,
        });
        expect(result).not.to.have.property('data');
        expect(
            fs
                .readdirSync(directory)
                .filter((name) => name.startsWith('video.mp4.part-')),
        ).to.deep.equal([]);
    });

    it('releases the exact browser media cache entry after publishing the file when requested', async function () {
        const events = [];
        const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), 'wwebjs-media-file-'),
        );
        temporaryDirectories.push(directory);
        const destination = path.join(directory, 'video.mp4');
        const message = createMediaMessage({
            blob: new Blob([Buffer.from('release me')]),
            onCacheDelete: (filehash) => {
                expect(fs.existsSync(destination)).to.equal(true);
                events.push(`delete:${filehash}`);
            },
            onCacheUsage: (direction, count) =>
                events.push(`${direction}:${count}`),
            onCollectGarbage: (method) => events.push(`cdp:${method}`),
        });

        await message.downloadMediaToFile(destination, {
            releaseBrowserMemory: true,
        });

        expect(events).to.deep.equal([
            'increase:1',
            'decrease:0',
            'delete:file-hash',
            'cdp:HeapProfiler.collectGarbage',
        ]);
    });

    it('removes the partial file when a later media chunk fails', async function () {
        const payload = Buffer.alloc(512 * 1024 + 1, 7);
        let transferCount = 0;
        const message = createMediaMessage({
            blob: new Blob([payload]),
            onArrayBuffer: () => {
                transferCount += 1;
                if (transferCount === 2) {
                    throw new Error('chunk transfer failed');
                }
            },
        });
        const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), 'wwebjs-media-file-'),
        );
        temporaryDirectories.push(directory);
        const destination = path.join(directory, 'video.mp4');

        let caughtError;
        try {
            await message.downloadMediaToFile(destination);
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).to.be.instanceOf(Error);
        expect(caughtError.message).to.equal('chunk transfer failed');
        expect(fs.existsSync(destination)).to.equal(false);
        expect(fs.readdirSync(directory)).to.deep.equal([]);
    });

    it('rejects a timed out native download without creating a destination file', async function () {
        const message = createMediaMessage({
            blob: new Blob([Buffer.from('late')]),
            downloadMedia: () => new Promise(() => {}),
        });
        const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), 'wwebjs-media-file-'),
        );
        temporaryDirectories.push(directory);
        const destination = path.join(directory, 'video.mp4');

        let caughtError;
        try {
            await message.downloadMediaToFile(destination, { timeoutMs: 10 });
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).to.be.instanceOf(Error);
        expect(caughtError.message).to.equal('downloadMediaToFile timeout');
        expect(fs.existsSync(destination)).to.equal(false);
        expect(fs.readdirSync(directory)).to.deep.equal([]);
    });
});
