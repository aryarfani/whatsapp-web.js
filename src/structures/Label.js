'use strict';

const Base = require('./Base');
// eslint-disable-next-line no-unused-vars
const Chat = require('./Chat');

const Colors = [
    "#ff9485",
    "#64c4ff",
    "#ffd429",
    "#dfaef0",
    "#99b6c1",
    "#55ccb3",
    "#ff9dff",
    "#d3a91d",
    "#6d7cce",
    "#d7e752",
    "#00d0e2",
    "#ffc5c7",
    "#93ceac",
    "#f74848",
    "#00a0f2",
    "#83e422",
    "#ffaf04",
    "#b5ebff",
    "#9ba6ff",
    "#9368cf"
]

/**
 * WhatsApp Business Label information
 */
class Label extends Base {
    /**
     * @param {Base} client
     * @param {object} labelData
     */
    constructor(client, labelData) {
        super(client);

        if (labelData) this._patch(labelData);
    }

    _patch(labelData) {
        /**
         * Label ID
         * @type {string}
         */
        this.id = labelData.id;

        /**
         * Label name
         * @type {string}
         */
        this.name = labelData.name;

        /**
         * Label hex color
         * @type {string}
         */
        this.hexColor = Colors[labelData.colorIndex];
    }
    /**
     * Get all chats that have been assigned this Label
     * @returns {Promise<Array<Chat>>}
     */
    async getChats() {
        return this.client.getChatsByLabelId(this.id);
    }

}

module.exports = Label;
