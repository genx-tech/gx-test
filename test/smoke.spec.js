const testSuite = require('../src/index');

testSuite(
    function (suite) {
        suite.testCase('smoke test', async function () {
            await suite.startRestClient_(
                'default',
                async (app, client) => {
                    await suite.testStep_('get employee', async () => {
                        const employees = await client.get('/employees');
                        console.log(employees)
                    });
                }
            );
        });
    }
);
