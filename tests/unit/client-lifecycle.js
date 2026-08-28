'use strict';

const { expect } = require('chai');
const Client = require('../../src/Client');

function createClient(events) {
    const authStrategy = {
        setup() {},
        async destroy() {
            events.push('auth:destroy');
        },
        async logout() {
            events.push('auth:logout');
        },
    };

    return new Client({ authStrategy });
}

describe('Client lifecycle', function () {
    it('uses Browser.connected to decide whether destroy closes the browser', async function () {
        const connectedEvents = [];
        const connectedClient = createClient(connectedEvents);
        connectedClient.pupBrowser = {
            connected: true,
            async close() {
                connectedEvents.push('browser:close');
                this.connected = false;
            },
        };

        await connectedClient.destroy();

        expect(connectedEvents).to.deep.equal([
            'browser:close',
            'auth:destroy',
        ]);

        const disconnectedEvents = [];
        const disconnectedClient = createClient(disconnectedEvents);
        disconnectedClient.pupBrowser = {
            connected: false,
            async close() {
                disconnectedEvents.push('browser:close');
            },
        };

        await disconnectedClient.destroy();

        expect(disconnectedEvents).to.deep.equal(['auth:destroy']);
    });

    it('uses Browser.connected while waiting for logout browser closure', async function () {
        const events = [];
        const client = createClient(events);
        client.pupPage = {
            async evaluate() {
                events.push('page:logout');
            },
        };
        client.pupBrowser = {
            connected: true,
            async close() {
                events.push('browser:close');
                this.connected = false;
            },
        };

        await client.logout();

        expect(events).to.deep.equal([
            'page:logout',
            'browser:close',
            'auth:logout',
        ]);
    });
});
