const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors({
    origin: 'https://remido--xeoww97un4.expo.app'
}));

const dashboardServer = require('./dashboard_server/src');
app.use('/dashboard', dashboardServer);

const apiServer = require('./api_server/src');
app.use('/api', apiServer);

const host = '0.0.0.0'; // '192.168.1.131'
const port = process.env.PORT || 4001;

app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
});
