const Virtru = require('virtru-sdk');
const SecureService = require('secure-lib').SecureService;

const secureService = SecureService.setup();

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

const encryptEmail = async (owner, subject, recipients, message, attachments) => {
    const attachmentPromises = [];
    const policyOptions = buildPolicyOptions(
        owner,
        subject,
        recipients,
        attachments
    );

    // attachments.forEach((rawFileAttachment) => {
    //     const attachmentPromise = secureService.makeFile(
    //
    //     );
    //     attachmentPromise.then(
    //         function (fileAttachment, attachment) {
    //             policyOptions.attachments.push(attachment.tdo.asXml());
    //             policyOptions.children.push(attachment.policyUuid);
    //             message += getChipContent(attachment, fileAttachment.size);
    //         }.bind(this, rawFileAttachment),
    //     );
    //     attachmentPromises.push(attachmentPromise);
    // });

    // return Promise.all(attachmentPromises).then(() => {
    return secureService.makeMessage(
        message,
        policyOptions
    );
    // });
};



function buildPolicyOptions(owner, subject, recipients, attachments) {
    return {
        owner: owner,
        sentFrom: owner,
        type: 'email',
        authorizations: ['copy', 'print', 'forward'],
        welcomeMessage: 'Welcome Message',
        displayName: subject,
        children: [],
        emailUsers: recipients,
        platform: 'secure-reader',
        attachmentsType: 'remote_content',
        attachments: attachments || [],
    };
}
function getChipContent() {

}

module.exports = {
    encryptAttachments,
    encryptEmail,
};