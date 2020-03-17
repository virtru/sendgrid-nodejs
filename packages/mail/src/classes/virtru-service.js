const Virtru = require('virtru-sdk');

const encryptAttachment = async (authData, attachmentBuffer, recipients) => {
    const client = new Virtru.Client(authData);
    const policy = new Virtru.PolicyBuilder()
        .build();
    const encryptParams = new Virtru.EncryptParamsBuilder()
        .withBufferSource(attachmentBuffer)
        .withUsersWithAccess(recipients)
        .withPolicy(policy)
        .build();
    const ct = await client.encrypt(encryptParams);
    const buffer = await ct.toBuffer();
    return buffer.toString('base64');
};

module.exports = {
    encryptAttachment,
};