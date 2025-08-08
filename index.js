const express = require('express');
const server = express();
const cors = require('cors');
server.use(cors());
server.use(express.json());


server.post('/shipping-rate',(req,res)=>{
    const body = req.body;
    console.log(body);
    res.json({
        data:body
    })
});

server.listen(8080,async ()=>{
    console.log('server conect');
});