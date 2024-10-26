//mongodb
require('./config/db');
const UserRouter = require('./api/User');
const AccountRouter = require('./api/Account');

const express = require('express'); 
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/user', UserRouter);
app.use('/account', AccountRouter);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})