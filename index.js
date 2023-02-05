const express     = require('express'),
    bcrypt      = require('bcrypt'),
    bodyParser  = require('body-parser'),
    jwt         = require("jsonwebtoken");


const auth = require("./middleware/auth");
const admin = require("./middleware/admin");


let app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const connectionString = "postgres://hgkgovsi:GyQFV6bo2hGNcADpA5DAX5SrffiPrkpu@hattie.db.elephantsql.com/hgkgovsi" || process.env.db || 'postgresql://ROOT:PASSWORD@localhost:5500/RESTAPP'
const Pool = require('pg').Pool
const pool = new Pool({
  connectionString
})

const User = '"User"'
const Employee = '"Employee"'
const Restaurant = '"Restaurant"'

app.post('/register', (req, res) => {
  if (!req.body.email || !req.body.password || req.body.email.length < 4 ||
    req.body.email.length > 20 || req.body.password.length < 4 || req.body.password.length > 30) {
    return res.status(401).json({
      message: "wrong credentials"
    })
  }

  pool.query(`SELECT * FROM ${User} WHERE email = $1`, [req.body.email], (error, results) => {
    if (error) {
      throw error
    }

    if (results.rows.length != 0) {
      return res.status(401).json({
        message: "user is already registered"
      })
    }

    let newId = Math.floor(Math.random() * 9000000) + 1000000

    const accessToken = jwt.sign({ id: newId, email: req.body.email, role: "client" },
      "process.env.TOKEN_KEY", {expiresIn: "2h"}
    );

    const refreshToken = jwt.sign({ id: newId, email: req.body.email }, 
      "process.env.TOKEN_KEY", { expiresIn: '100d' }
    );

    pool.query(`INSERT INTO ${User} (id, email, password, access_token, refresh_token)
    VALUES ($1, $2, $3, $4, $5)`, [newId, req.body.email, req.body.password, accessToken, refreshToken], (error, results) => {
      if (error) {
        throw error
      }
      res.status(200).json({
        accessToken, refreshToken
      })
    })
  })
})

app.post('/login', (req, res) => {
  if (!req.body.email || !req.body.password || req.body.email.length < 4 ||
    req.body.email.length > 20 || req.body.password.length < 4 || req.body.password.length > 30) {
    return res.status(401).json({
      message: "wrong credentials"
    })
  }

  pool.query(`SELECT * FROM ${User} WHERE email = $1`, [req.body.email], (error, results) => {
    if (error) {
      throw error
    }

    if (results.rows.length == 0) {
      return res.status(401).json({
        message: "user with this email is not registered"
      })
    }

    if (results.rows[0].password != req.body.password) {
      return res.status(401).json({
        message: "wrong password"
      })
    }

    const accessToken = jwt.sign(
      { id: results.rows[0].id, email: results.rows[0].email, role: "client" },
      "process.env.TOKEN_KEY", {expiresIn: "2h"}
    );

    const refreshToken = jwt.sign(
      { id: results.rows[0].id, email: results.rows[0].email, role: "client" }, 
      "process.env.TOKEN_KEY", { expiresIn: '100d' }
    );

    res.status(200).json({
      message: "welcome back",
      user: { accessToken, refreshToken }
    })
  })
})

app.post('/employee_login', (req, res) => {
  if (!req.body.email || !req.body.password || req.body.email.length < 4 ||
    req.body.email.length > 20 || req.body.password.length < 4 || req.body.password.length > 30) {
    return res.status(401).json({
      message: "wrong credentials"
    })
  }

  pool.query(`SELECT * FROM ${Employee} WHERE restaurant_id = $1 AND email = $2`,
  [req.body.restaurant_id, req.body.email], (error, results) => {
    if (error) {
      throw error
    }

    if (results.rows.length == 0) {
      return res.status(401).json({
        message: "admin with this email is not registered in this restaurant"
      })
    }

    if (results.rows[0].password != req.body.password) {
      return res.status(401).json({
        message: "wrong password"
      })
    }

    const accessToken = jwt.sign(
      { id: results.rows[0].id, email: results.rows[0].email,
        role: results.rows[0].role, restaurant_id: results.rows[0].restaurant_id },
      "process.env.TOKEN_KEY", {expiresIn: "2h"}
    );

    const refreshToken = jwt.sign(
      { id: results.rows[0].id, email: results.rows[0].email,
        role: results.rows[0].role, restaurant_id: results.rows[0].restaurant_id }, 
      "process.env.TOKEN_KEY", { expiresIn: '100d' }
    );

    res.status(200).json({
      message: `welcome back, ${results.rows[0].role}`,
      user: { accessToken, refreshToken }
    })
  })
})

app.post('/show_employees', auth, admin, (req, res) => {
  pool.query(`SELECT "name", "role", "email" FROM ${Employee} WHERE restaurant_id = $1 AND removed = FALSE`,
  [req.user.restaurant_id], (error, results) => {
    if (error) {
      throw error
    }
    res.status(200).json({
      message: `employees list`,
      employees: results.rows,
      user: req.user
    })
  })
})

app.post('/add_employee', auth, admin, (req, res) => {
  if (!req.body.email || !req.body.password || !req.body.name || req.body.email.length < 4 ||
    req.body.email.length > 20 || req.body.password.length < 4 || req.body.password.length > 30 ||
    req.body.name.length > 30 || req.body.name.length < 4) {
    return res.status(401).json({
      message: "wrong credentials"
    })
  }

  if (req.body.role != "waiter" && req.body.role != "chef") {
    return res.status(401).json({ message: "wrong role" })
  }

  let newId = Math.floor(Math.random() * 9000000) + 1000000

  pool.query(`INSERT INTO ${Employee} (id, email, password, name, restaurant_id, role) VALUES ($1, $2, $3, $4, $5, $6)`, 
  [newId, req.body.email, req.body.password, req.body.name, req.user.restaurant_id, req.body.role],
  (error, results) => {
    if (error) {
      throw error
    }
    res.status(200).json({
      message: `employees list`,
      employees: results.rows,
      user: req.user
    })
  })
})

app.post('/remove_employee', auth, admin, (req, res) => {

  pool.query(`UPDATE ${Employee} SET removed = TRUE WHERE id = $1`, [req.body.id],
  (error, results) => {
    if (error) {
      throw error
    }
    res.status(200).json({
      message: `successfully removed`,
      employees: results.rows,
      user: req.user
    })
  })
})

app.post('/restaurant', (req, res) => {
  pool.query(`SELECT "name", "address", "description", "working_hours", "contacts" FROM ${Restaurant} WHERE id = $1`,
  [req.body.restaurant_id], (error, results) => {
    if (error) {
      throw error
    }
    res.status(200).json({
      restaurant: results.rows[0],
      user: req.user
    })
  })
})

app.post('/news', auth, (req, res) => {
  res.status(200).json({
    message: "hello, world!!!",
    user: req.user
  })
})

app.listen(process.env.PORT || 3000)