import express from 'express';
import path from 'path';
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
import worldRegionsRouter from './routes/worldRegions';
import gpxGeotagRouter from './routes/gpx-geotag';
import wishListRouter from './routes/wishLists';

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '16mb' }));

// NOTE: express-fileupload is intentionally NOT registered globally because
// it consumes multipart request bodies and would break formidable-based
// upload routes (/api/photos/upload, /api/users/:id/avatar).
// It's scoped to the gpx-geotag endpoint only — see routes/gpx-geotag.ts.

// Serve uploaded files (avatars, etc.)
app.use('/api/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve tools (gpx-geotag, etc.)
// Use process.cwd() as fallback for development, __dirname for production
const toolsPath =
  process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '..', '..', 'tools')
    : path.join(process.cwd(), 'tools');
app.use('/tools', express.static(toolsPath));

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
app.use(worldRegionsRouter);
app.use(gpxGeotagRouter);
app.use(wishListRouter);

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
