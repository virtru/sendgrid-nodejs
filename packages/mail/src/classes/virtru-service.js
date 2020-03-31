const Virtru = require('virtru-sdk');

const encryptAttachment = async (attachmentBuffer, fileName, authData, recipients) => {
    const client = new Virtru.Client(authData);
    const policy = new Virtru.PolicyBuilder()
        .build();
    const encryptParams = new Virtru.EncryptParamsBuilder()
        .withBufferSource(attachmentBuffer)
        .withUsersWithAccess(recipients)
        .withDisplayFilename(fileName)
        .withPolicy(policy)
        .build();
    const ct = await client.encrypt(encryptParams);
    const buffer = await ct.toBuffer();
    return buffer.toString('base64');
};
const encryptAttachments = async (attachments, virtruAuth, sharedUserEmails) => {
    const result = attachments.map(async (attachment) => {
        const attachmentBuffer = Buffer.from(attachment.content, 'base64');
        const encryptedBase64String = await encryptAttachment(attachmentBuffer, attachment.filename, virtruAuth, sharedUserEmails);
        return {
            content: encryptedBase64String,
            filename: `${attachment.filename}.tdf.html`,
            type: 'text/html',
            disposition: 'attachment',
            contentId: `${attachment.contentId}_tdf_html`
        };
    });
    return Promise.all(result);
};

const encryptEmail = async (recipients, message, attachments) => {
    return await client.encryptEmail(owner, subject, recipients, message, attachments);
};

module.exports = {
    encryptAttachments,
    encryptEmail,
};