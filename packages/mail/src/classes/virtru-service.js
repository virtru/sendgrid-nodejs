const Virtru = require('virtru-sdk');

const encryptMessage = async (authData, message) => {
    const client = new Virtru.Client(authData);
    const policy = new Virtru.PolicyBuilder()
        .build();
    const encryptParams = new Virtru.EncryptParamsBuilder()
        .withStringSource(message)
        .withPolicy(policy)
        .build();
    const ct = await client.encrypt(encryptParams);
    const buffer = await ct.toBuffer();
    return buffer.toString('base64');
};

module.exports = {
    encryptMessage,
};