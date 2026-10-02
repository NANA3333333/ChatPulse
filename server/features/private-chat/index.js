// Public entry points. Importing this module does not open a database or start a worker.
const { createPrivateReplyVersions } = require("./replyVersionsRepository");
const { createReplyVersionService } = require("./replyVersionService");
const { createReplyGenerator } = require("./generateReply");
const { registerPrivateReplyRoutes } = require("./routes");

const { createMessageRepository } = require("./messageRepository");
const { createMessageService } = require("./messageService");
const { registerPrivateMessageRoutes } = require("./messageRoutes");

module.exports = { createMessageRepository, createMessageService, registerPrivateMessageRoutes, createPrivateReplyVersions, createReplyVersionService, createReplyGenerator, registerPrivateReplyRoutes };
