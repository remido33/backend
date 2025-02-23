
const app = require('../dashboard_server/src');
const host = process.env.HOST ||  '192.168.1.131';
const port = process.env.PORT || 4001;

app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
});