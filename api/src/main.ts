import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import usersRouter from './routes/users';
import attractions from './routes/attractions';
import sessionRouter from './routes/session';
import checkInsRouter from './routes/checkIns';
import citiesRouter from './routes/cities';
import countriesRouter from './routes/countries';
import geocodeRouter from './routes/geocode';
import infoRouter from './routes/info';
import locationRouter from './routes/location';
import tagsRouter from './routes/tags';
import photosRouter from './routes/photos';
import rolesRouter from './routes/roles';
import statesRouter from './routes/states';
import tripsRouter from './routes/trips';
import statsRouter from './routes/stats';
import profileRouter from './routes/profile';

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '16mb' }));

app.use(usersRouter);
app.use(attractions);
app.use(sessionRouter);
app.use(checkInsRouter);
app.use(citiesRouter);
app.use(countriesRouter);
app.use(geocodeRouter);
app.use(infoRouter);
app.use(locationRouter);
app.use(tagsRouter);
app.use(photosRouter);
app.use(rolesRouter);
app.use(statesRouter);
app.use(tripsRouter);
app.use(statsRouter);
app.use(profileRouter);

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
