const express     = require('express'),
    bcrypt      = require('bcrypt'),
    bodyParser  = require('body-parser'),
    cors        = require("cors"),
    jwt         = require("jsonwebtoken");
    logger      = require('pino')()


const auth = require("./middleware/auth");
const admin = require("./middleware/admin");


let app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions));

const connectionString = "postgres://MichaelisMur:la1oIMxFt4NZ@ep-wispy-voice-05259317.eu-central-1.aws.neon.tech/neondb?ssl=true" || process.env.db || 'postgresql://ROOT:PASSWORD@localhost:5500/RESTAPP'
const Pool = require('pg').Pool
const pool = new Pool({
  connectionString
})


const User = '"User"'
const Employee = '"Employee"'
const Restaurant = '"Restaurant"'
const RestaurantScreens = '"Restaurant_Screens"'
const RestaurantMenu = '"Restaurant_Menu"'
const ScreensImages = '"Screens_Images"'

app.post('/register', (req, res) => {
  // логирование запроса на регистрацию клиента
  const log = logger.child({ body: req.body })
  log.info('/register')

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
  // логирование запроса на логин клиента
  const log = logger.child({ body: req.body })
  log.info('/login')

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
      { id: results.rows[0].id, email: results.rows[0].email, role: "" },
      "process.env.TOKEN_KEY", {expiresIn: "2h"}
    );

    const refreshToken = jwt.sign(
      { id: results.rows[0].id, email: results.rows[0].email, role: "" }, 
      "process.env.TOKEN_KEY", { expiresIn: '100d' }
    );

    res.status(200).json({
      message: "welcome back",
      user: { accessToken, refreshToken }
    })
  })
})

app.post('/employee_login', (req, res) => {
  // логирование запроса на логин сотрудника
  const log = logger.child({ body: req.body })
  log.info('/employee_login')
  
  if (!req.body.email || !req.body.password || req.body.email.length < 4 ||
    req.body.email.length > 20 || req.body.password.length < 4 || req.body.password.length > 30) {
    return res.status(401).json({
      message: "wrong credentials"
    })
  }

  pool.query(`SELECT * FROM ${Employee} WHERE email = $1`,
  [req.body.email], (error, results) => {
    if (error) {
      throw error
    }

    if (results.rows.length == 0) {
      return res.status(401).json({
        message: "employee with this email is not registered"
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
  // логирование запроса на отображения информации о сотрудниках
  const log = logger.child({ body: req.body })
  log.info('/show_employees')
  
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
  // логирование запроса на добавление сотрудника
  const log = logger.child({ body: req.body })
  log.info('/add_employee')
  
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
  // логирование запроса на удаление сотрудника
  const log = logger.child({ body: req.body })
  log.info('/remove_employee')
  
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

app.post('/restaurants', (req, res) => {
  // логирование запроса на отображение ресторанов
  const log = logger.child({ body: req.body })
  log.info('/restaurants')
  
  pool.query(`SELECT "name", "address", "description", "working_hours", "contacts", "id" FROM ${Restaurant}`,
  [], (error, results) => {
    if (error) {
      throw error
    }
    res.status(200).json({
      restaurant: results.rows,
      user: req.user
    })
  })
})

app.post('/restaurant', (req, res) => {
  // логирование запроса на отображение информации о ресторане
  const log = logger.child({ body: req.body })
  log.info('/restaurant')
  
  pool.query(`SELECT "name", "address", "description", "working_hours", "contacts" FROM ${Restaurant} WHERE id = $1`,
    [req.body.restaurant_id])
  .then((resultRestaurant) => {
    
    pool.query(`SELECT "restaurant_id", "screen_number", "page_number", "page_title", "page_text", "screen_type" FROM ${RestaurantScreens} WHERE restaurant_id = $1`,
      [req.body.restaurant_id])
    .then((resultScreens) => {

      pool.query(`SELECT "restaurant_id", "screen_number", "page_number", "img_link" FROM ${ScreensImages} WHERE restaurant_id = $1`,
          [req.body.restaurant_id])
      .then((resultImages) => {

        let arrayToWorkWith = [{info: []}, {info: []}, {info: []}, {info: []}, {info: []}, {info: []}, {info: []}]
        resultScreens.rows.forEach(screen => {

          arrayToWorkWith[screen.screen_number - 1].info[screen.page_number - 1] = {
            title: screen.page_title,
            text: screen.page_text,
            images: resultImages.rows.filter(image => (
              image.screen_number == screen.screen_number && image.page_number == screen.page_number
            )).map(img => img.img_link)
          }
          arrayToWorkWith[screen.screen_number - 1].type = screen.screen_type

        })

        arrayToWorkWith = arrayToWorkWith.filter(e => e.info.length != 0);

        console.log(arrayToWorkWith)
        res.status(200).json({
          ...resultRestaurant.rows[0],
          screens: arrayToWorkWith,
          user: req.user
        })

      })
    })
    .catch((err) => console.error('Error executing query', err.stack))
  })
  .catch((err) => console.error('Error executing query', err.stack))
})

app.post('/restaurant_edit', auth, (req, res) => {
  // логирование запроса на редактирование информации о ресторане
  const log = logger.child({ body: req.body })
  log.info('/restaurant_edit')
  
  switch (req.body.action) {
    case("name"):
      pool.query(`UPDATE ${Restaurant} SET name = $1 WHERE id = $2`,
      [req.body.value, req.body.restaurant_id])
        .then((resultRestaurant) => {
          res.status(200).json({
            result: resultRestaurant,
            user: req.user
          })
        })
      break
      
    case("address"):
      pool.query(`UPDATE ${Restaurant} SET address = $1 WHERE id = $2`,
      [req.body.value, req.body.restaurant_id])
        .then((resultRestaurant) => {
          res.status(200).json({
            result: resultRestaurant,
            user: req.user
          })
        })
      break
    
    case("description"):
      pool.query(`UPDATE ${Restaurant} SET description = $1 WHERE id = $2`,
      [req.body.value, req.body.restaurant_id])
        .then((resultRestaurant) => {
          res.status(200).json({
            result: resultRestaurant,
            user: req.user
          })
        })
      break
      
    case("working_hours"):
      pool.query(`UPDATE ${Restaurant} SET working_hours = $1 WHERE id = $2`,
      [req.body.value, req.body.restaurant_id])
        .then((resultRestaurant) => {
          res.status(200).json({
            result: resultRestaurant,
            user: req.user
          })
        })
      break
      
      case("contacts"):
        pool.query(`UPDATE ${Restaurant} SET contacts = $1 WHERE id = $2`,
        [req.body.value, req.body.restaurant_id])
          .then((resultRestaurant) => {
            res.status(200).json({
              result: resultRestaurant,
              user: req.user
            })
          })
        break
      
      case("screens"):
        // pool.query(`UPDATE ${Restaurant} SET screens = $1 WHERE id = $2`,
        // [req.body.value, req.body.restaurant_id])
        //   .then((resultRestaurant) => {
        //     res.status(200).json({
        //       result: resultRestaurant,
        //       user: req.user
        //     })
        //   })
        break
  }
})

app.post('/news', auth, (req, res) => {
  const log = logger.child({ body: req.body })
  log.info('/news')
  
  res.status(200).json({
    message: "hello, world!!!",
    user: req.user
  })
})

app.listen(process.env.PORT || 3000)