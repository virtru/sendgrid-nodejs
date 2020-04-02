const { config } = require('www-cfg');

const SecureService = require('secure-lib').SecureService;

const base64 = require('virtru-base64');

const TemplateService = require('client-common-utils').templates;

const templateService = TemplateService.create();

const secureService = SecureService.setup();

// const encryptAttachment = async (attachmentBuffer, fileName, authData, recipients) => {
//     const client = new Virtru.Client(authData);
//     const policy = new Virtru.PolicyBuilder()
//         .build();
//     const encryptParams = new Virtru.EncryptParamsBuilder()
//         .withBufferSource(attachmentBuffer)
//         .withUsersWithAccess(recipients)
//         .withDisplayFilename(fileName)
//         .withPolicy(policy)
//         .build();
//     const ct = await client.encrypt(encryptParams);
//     const buffer = await ct.toBuffer();
//     return buffer.toString('base64');
// };
// const encryptAttachments = async (attachments, virtruAuth, sharedUserEmails) => {
//     const result = attachments.map(async (attachment) => {
//         const attachmentBuffer = Buffer.from(attachment.content, 'base64');
//         const encryptedBase64String = await encryptAttachment(attachmentBuffer, attachment.filename, virtruAuth, sharedUserEmails);
//         return {
//             content: encryptedBase64String,
//             filename: `${attachment.filename}.tdf.html`,
//             type: 'text/html',
//             disposition: 'attachment',
//             contentId: `${attachment.contentId}_tdf_html`
//         };
//     });
//     return Promise.all(result);
// };

const encryptEmail = async (owner, subject, recipients, message, attachments) => {
    const attachmentPromises = [];
    const policyOptions = buildPolicyOptions(
        owner,
        subject,
        recipients,
        attachments
    );

    const connectOptions = {
        clientString: "secure-reader:6.48.0",
        mainAcmUrl: "https://acm-develop01.develop.virtru.com",
        eventsUrl: "https://events-develop01.develop.virtru.com",
        accountsUrl: "https://accounts-develop01.develop.virtru.com",
        apiUrl: "https://api-develop01.develop.virtru.com",
        remoteContentBaseUrl: "https://secure-develop01.develop.virtru.com/start/",
        cdnUrl: "https://cdn-develop01.develop.virtru.com",
        userId: "narvolo.redl@gmail.com",
        appIdDomains: {
            'accounts-develop01.develop.virtru.com': "4c1422d3-736e-43d6-8a1d-90bffb93a3dc",
            'acm-develop01.develop.virtru.com': "4c1422d3-736e-43d6-8a1d-90bffb93a3dc",
            'events-develop01.develop.virtru.com': "4c1422d3-736e-43d6-8a1d-90bffb93a3dc",
            'api-develop01.develop.virtru.com': "4c1422d3-736e-43d6-8a1d-90bffb93a3dc",
        }
    };
    const templateUri = `${connectOptions.cdnUrl}/templates/virtru/base.template`;

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
    const result = await secureService.makeMessage(
        message,
        policyOptions,
        connectOptions
    );

    const templateData = await templateService.fetch(templateUri);
    const templateHtml = templateData && templateData.templateHtml;

    return buildSecureWrapper(result, policyOptions, templateHtml);
    // });
};



function buildSecureWrapper(
    result,
    policyOptions,
    templateHtml,
) {
    const metadata = {
        version: '1.4.0',
        messageId: result.policyUuid,
        remoteContentLink: result.remoteContentLink,
        'user.platform': config.client,
        'user.platform.version': config.version,
    };

    const templateData = {
        secureMessage: base64.encode(result.tdf.asXml()),

        // TODO: messageId will need to be calculated once we support chains here
        messageId: 0,
        previousMessages: undefined,
        messageUUID: result.policyUuid,
        metadata: base64.encode(JSON.stringify(metadata)),
        microTdfLink: result.remoteContentLink,
        senderName: policyOptions.ownerDisplayName
            ? policyOptions.ownerDisplayName
            : policyOptions.owner,
        senderAddress: policyOptions.owner,
        mobileLink: `virtru://message?uuid=${result.policyUuid}`,
        welcomeMessage: policyOptions.welcomeMessage
            ? function () {
                return policyOptions.welcomeMessage;
            }
            : undefined,
        emailSubject: policyOptions.displayName,
    };

    // Work-around for making double-braces into triple-braces.
    // This makes Mustache unescape URL characters in the Unlock Button Link.
    // This seems needed to prevent Yahoo from not printing the href.
    // See JIRA Tickets:
    // https://virtru.atlassian.net/browse/WS-2139
    // https://virtru.atlassian.net/browse/WS-8613
    const newTemplateHtml = templateHtml.replace(/({{\.}})(?!})/g, '{{{.}}}');

    return templateService.render(newTemplateHtml, templateData);
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
    // encryptAttachments,
    encryptEmail,
};