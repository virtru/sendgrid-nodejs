const { config } = require('www-cfg');

const SecureService = require('secure-lib').SecureService;

const base64 = require('virtru-base64');

const TemplateService = require('client-common-utils').templates;

const templateService = TemplateService.create();

const secureService = SecureService.setup();

const fetch = require('node-fetch');

const { Binary } = require('binary');


const encryptEmail = async (virtruAuth, owner, subject, recipients, message, attachments) => {
    const attachmentPromises = [];
    const policyOptions = buildPolicyOptions(
        owner,
        subject,
        recipients
    );

    const environment = virtruAuth.environment || 'production';
    const env = config.env[environment];

    const Authorization = `Virtru [["${virtruAuth.appId}","${virtruAuth.email}"]]`;
    const userSettingsRequest = await fetch(`${env.apiUrl}/accounts/api/userSettings`, {
        headers: {
            Authorization
        }
    });
    const userSettingsArray = await userSettingsRequest.json();
    const userSettings = userSettingsArray[0];

    const connectOptions = generateConnectOptions(virtruAuth, userSettings, env);

    const templateUri = userSettings.templateUri;

    attachments.forEach((attachment) => {
        const { filename, content, type, filesize } = attachment;
        const attachmentBuffer = Buffer.from(content, 'base64');
        const binary = Binary.fromBuffer(attachmentBuffer);
        const attachmentPromise = secureService.makeFile(
            binary,
            filename,
            policyOptions,
            connectOptions,
            type,
        );
        attachmentPromise.then((attachment) => {
            policyOptions.attachments.push(attachment.tdo.asXml());
            policyOptions.children.push(attachment.policyUuid);
            message += getChipContent(
                attachment.tdo.payload.filename,
                filesize,
                attachment.tdo.payload.mediaType,
                attachment.tdo.id,
                attachment.policyUuid);

        });
        attachmentPromises.push(attachmentPromise);
    });

    return Promise.all(attachmentPromises).then(async () => {
        const result = await secureService.makeMessage(
            message,
            policyOptions,
            connectOptions
        );

        const templateData = await templateService.fetch(templateUri);
        const templateHtml = templateData && templateData.templateHtml;

        return buildSecureWrapper(result, policyOptions, templateHtml);
    });
};

function generateConnectOptions(virtruAuth, userSettings, env) {
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

    const appIdDomains = {};
    userSettings.appIdBundle.authorizedDomains.forEach((domain) => {
        appIdDomains[domain] = virtruAuth.appId
    });
    return {
        ...defaultConnectOptions,
        userId: virtruAuth.email,
        appIdDomains
    };
}


function buildSecureWrapper(result, policyOptions, templateHtml) {
    const metadata = {
        version: '1.4.0',
        messageId: result.policyUuid,
        remoteContentLink: result.remoteContentLink,
        'user.platform': 'secure-reader',
        'user.platform.version': '6.48.0',
    };

    const templateData = {
        secureMessage: base64.encode(result.tdf.asXml()),
        messageId: 0,
        previousMessages: undefined,
        messageUUID: result.policyUuid,
        metadata: base64.encode(JSON.stringify(metadata)),
        microTdfLink: result.remoteContentLink,
        senderName: policyOptions.owner,
        senderAddress: policyOptions.owner,
        mobileLink: `virtru://message?uuid=${result.policyUuid}`,
        welcomeMessage: policyOptions.welcomeMessage
            ? function () {
                return policyOptions.welcomeMessage;
            }
            : undefined,
        emailSubject: policyOptions.displayName,
    };
    const newTemplateHtml = templateHtml.replace(/({{\.}})(?!})/g, '{{{.}}}');

    return templateService.render(newTemplateHtml, templateData);
}

function buildPolicyOptions(owner, subject, recipients) {
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
        attachments: [],
    };
}

function getChipContent(filename, filesize, mediaType, tdoid, policyuuid) {
    const templateData = {
        filename: filename,
        filesize: filesize,
        tdoid: tdoid,
        policyuuid: policyuuid,
    };
    return templateService.renderAttachmentChip(templateData);
}

module.exports = {
    // encryptAttachments,
    encryptEmail,
};