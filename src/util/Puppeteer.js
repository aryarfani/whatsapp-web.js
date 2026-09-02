/**
 * Expose a function to the page if it does not exist
 *
 * NOTE:
 * Rewrite it to 'upsertFunction' after updating Puppeteer to 20.6 or higher
 * using page.removeExposedFunction
 * https://pptr.dev/api/puppeteer.page.removeexposedfunction
 *
 * @param {object} page - Puppeteer Page instance
 * @param {string} name
 * @param {Function} fn
 */
async function exposeFunctionIfAbsent(page, name, fn) {
    const debugPrefix = '[DEBUG-wwebjs-inject]';
    const pageState = () => ({
        closed: page.isClosed(),
        url: page.url(),
    });
    console.error(debugPrefix, 'evaluate:start', name, pageState());
    let exist;
    try {
        exist = await page.evaluate((name) => {
            return !!window[name];
        }, name);
        console.error(debugPrefix, 'evaluate:done', name, { exist, ...pageState() });
    } catch (error) {
        console.error(debugPrefix, 'evaluate:error', name, pageState(), error);
        throw error;
    }
    if (exist) {
        return;
    }
    console.error(debugPrefix, 'expose:start', name, pageState());
    try {
        await page.exposeFunction(name, fn);
        console.error(debugPrefix, 'expose:done', name, pageState());
    } catch (error) {
        console.error(debugPrefix, 'expose:error', name, pageState(), error);
        throw error;
    }
}

module.exports = { exposeFunctionIfAbsent };
