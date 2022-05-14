const { _, get } = require("@genx/july");

const tokenCache = {};

function defaultUserAuth(app, userTag) {
    return async (client) => {
        if (!userTag) {
            delete client.onSend;
            return client;
        }

        let token, userAuth;

        if (_.isPlainObject(userTag)) {
            token = tokenCache[userTag.userTag];
            userAuth = userTag;
        } else {
            token = tokenCache[userTag];
            userAuth = app.settings.userAuth[userTag];
        }

        if (!token) {
            if (!userAuth.endpoint || !userAuth.username || !userAuth.password) {
                throw new Error(
                    `"endpoint", "username", "password" is required for "userAuth" settings of user "${userTag}".`
                );
            }

            let body = await client.post(userAuth.endpoint, {
                username: userAuth.username,
                password: userAuth.password,
            });
            if (userAuth.tokenKey) {
                token = get(body, userAuth.tokenKey);
            } else {
                token = body.token;
            }
            tokenCache[userTag] = token;

            app.log("info", `Logged in with [${userTag}].`);
        }

        client.onSend = (req) => {
            req.set("Authorization", `Bearer ${token}`);
        };
    };
}

module.exports = defaultUserAuth;
