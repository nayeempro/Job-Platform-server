const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 2222
const app = express()
const cookieParser = require('cookie-parser')
const corsOptions = {
  origin: ['http://localhost:5173'],
  credentials: true,
  optionalSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json())
app.use(cookieParser())




const uri = "mongodb+srv://mdnayeemsha420:Z6c3qHT22qiO45DS@tuitionportal-1.akcu0.mongodb.net/?retryWrites=true&w=majority&appName=tuitionPortal-1";


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const db = client.db('tuitionPortal')
    const tuitionCollection = db.collection('tuitions')
    const bidsCollection = db.collection('bidsInfo')

    // create json web token
    app.post('/jwt', async (req, res) => {
      const email = req.body

      const token = jwt.sign(email, `${process.env.SECRET_KEY}`, {
        expiresIn: '30d'
      })

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true })
    })

    //verify Token 
    const verifyToken = (req, res, next) => {
      const token = req.cookies?.token
      console.log('token is',token)
      if(!token) {
        return res.status(401).send({ massage: "unauthorize access" })
      }else{
        jwt.verify(token, `${process.env.SECRET_KEY}`, (err, decoded) => {
          if (err) {
            return res.status(401).send({ massage: "unauthorize access" })
          } else {
            req.user = decoded;
            // next use only successful verification
            next() 
          }
          
        })
      }
      
      
    }


    // logout || Clear Cookie 
    app.get('/logout', async (req, res) => {
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true })
    })
    // Add tuition into database
    app.post('/jobs', async (req, res) => {
      const data = req.body;
      const result = await tuitionCollection.insertOne(data)
      res.send(result)

    })
    // get tuition data from database
    app.get('/jobs', async (req, res) => {

      const result = await tuitionCollection.find().toArray()
      res.send(result)

    })
    // get all jobs by filter
    app.get('/all-jobs', async (req, res) => {

      // get query from client
      const filterClient = req.query.filter
      const searchClient = req.query.search
      const sortClient = req.query.sort
      // console.log(filterClient)
      let query = {
        title: {
          $regex: searchClient,
          $options: 'i',
        }
      }
      if (filterClient) {
        query.category = filterClient;
      }
      const option = {}
      if (sortClient) {

        option = { deadline: sortClient === 'asc' ? 1 : -1 }
        // 1 mean ascending -1 means descending

      }

      const result = await tuitionCollection.find(query, option).toArray()
      res.send(result)
    })
    // get all data posted by a specific user( via email)

    app.get('/jobs/:email', verifyToken ,async (req, res) => {
      const email = req.params.email
      const query = { 'buyer.email': email }
      const decodedEmail = req.user?.email
      
    
      console.log("mail from token",decodedEmail)
      console.log("mail from params",email)
      if(decodedEmail !== email) return res.status(401).send({ massage: "unauthorize access"})

      const result = await tuitionCollection.find(query).toArray()
      res.send(result)

    })

    // get a job by using id from database

    app.get('/job/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await tuitionCollection.findOne(query)
      res.send(result)
    })

    // update tuition into database
    app.put('/update-job/:id', async (req, res) => {
      const id = req.params.id
      const data = req.body;
      const query = { _id: new ObjectId(id) }
      const updated = {
        $set: data,
      }
      const options = { upsert: true }
      const result = await tuitionCollection.updateOne(query, updated, options)
      res.send(result)

    })

    // delete a job by using id
    app.delete('/job/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await tuitionCollection.deleteOne(query)
      res.send(result)
    })


    // =============================BID=================================


    // ===================Bid related Api============================
    // save bid data in database
    app.post('/bids', async (req, res) => {
      const bidData = req.body
      // 0. Checked if a user already placed a bid for this job
      const filterUserJob = { email: bidData.email, jobId: bidData.jobId }
      const alreadyExist = await bidsCollection.findOne(filterUserJob)
      // console.log(alreadyExist)
      if (alreadyExist) return res.status(404).send("you have already placed the job")

      // 1.save the bid data 
      const result = await bidsCollection.insertOne(bidData)

      //2. increase the bidCounts(update)
      const filter = { _id: new ObjectId(bidData.jobId) }
      const update = {
        $inc: { bid_count: 1 },
      }
      const updateCount = await tuitionCollection.updateOne(filter, update)
      res.send(result)
    })
    // get my bid data and bid request data dynamically
    app.get('/bids/:email', verifyToken, async (req, res) => {

      const buyerQuery = req.query.buyer
    
      const decodedEmail = req.user?.email
      const email = req.params.email
    
      console.log("mail from token",decodedEmail)
      console.log("mail from params",email)
      if(decodedEmail !== email) return res.status(401).send({ massage: "unauthorize access"})
      let query = {}
      // if buyer true then its work for bid request else work for my bid
      if (buyerQuery) {
        query = { buyer_email: email }
      } else {
        query = { email: email }
      }

      const result = await bidsCollection.find(query).toArray()
      res.send(result)
    })

    // get bid request (do same thing in my bid)
    // app.get('/bid-request/:email', async(req,res)=>{
    //   const email = req.params.email
    //   const query = {buyer_email: email}
    //   const result = await bidsCollection.find(query).toArray()
    //   res.send(result)
    // })

    // Bid Status Update
    app.patch('/bid-status-update/:id', async (req, res) => {
      const id = req.params.id
      const status = req.body
      console.log(status, id)
      const filter = { _id: new ObjectId(id) }
      const update = {
        $set: { status: status.status },
      }
      const result = await bidsCollection.updateOne(filter, update)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from tuitionPortal Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
