const { config } = require('www-cfg');

const SecureService = require('secure-lib').SecureService;

const base64 = require('virtru-base64');

const TemplateService = require('client-common-utils').templates;

const templateService = TemplateService.create();

const secureService = SecureService.setup();

const encryptEmail = async (virtruAuth, owner, subject, recipients, message, attachments) => {
    const attachmentPromises = [];
    const policyOptions = buildPolicyOptions(
        owner,
        subject,
        recipients,
        attachments
    );


    const Authorization = `Virtru [["${virtruAuth.appId}","${virtruAuth.email}"]]`;
    const userSettingsRequest = await fetch(`${env.apiUrl}/accounts/api/userSettings`, {
        headers: {
            Authorization
        }
    });
    const userSettings = userSettingsRequest.json();

    const connectOptions = generateConnectOptions(virtruAuth, userSettings);

    const templateUri = userSettings.templateUri;

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

async function generateConnectOptions(virtruAuth, userSettings) {
    const env = config.env[virtruAuth.environment];
    let secureAppsBaseUrl = userSettings && userSettings.secureAppsBaseUrl;
    if (secureAppsBaseUrl) {
        secureAppsBaseUrl += '/start/';
    }
    const defaultConnectOptions = {
        mainAcmUrl: env.mainAcmUrl,
        eventsUrl: env.eventsUrl,
        accountsUrl: env.accountsUrl,
        apiUrl: env.apiUrl,
        remoteContentBaseUrl: secureAppsBaseUrl,
        cdnUrl: env.cdnUrl,
    };

    return {
        ...defaultConnectOptions,
        userId: virtruAuth.email,
        appIdDomains: {
            'accounts-develop01.develop.virtru.com': virtruAuth.appId,
            'acm-develop01.develop.virtru.com': virtruAuth.appId,
            'events-develop01.develop.virtru.com': virtruAuth.appId,
            'api-develop01.develop.virtru.com': virtruAuth.appId,
        }
    };
}


function buildSecureWrapper(result, policyOptions, templateHtml) {
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
}

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