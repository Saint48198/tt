import express from 'express';
import cookieParser from 'cookie-parser';

import userTokenRouter from './routes/userToken.js';
import usersRouter from './routes/users.js';
import changePasswordRouter from './routes/changePassword.js';
import attractions from './routes/attractions.js';
import login from './routes/login.js';
import logoutRouter from './routes/logout.js';
import sessionRouter from './routes/session.js';
import verifyTokenRouter from './routes/verifyToken.js';
import checkInsRouter from './routes/checkIns.js';
import checkInMessagesRouter from './routes/checkInMessages.js';
import citiesRouter from './routes/cities.js';
import countriesRouter from './routes/countries.js';
import geocodeRouter from './routes/geocode.js';
import infoRouter from './routes/info.js';
import updateLocationVisitedRouter from './routes/updateLocationVisited.js';
import photosByEntityRouter from './routes/photosByEntity.js';
import addPhotoByEntityRouter from './routes/addPhotoByEntity.js';
import photosBulkAddRouter from './routes/photosBulkAdd.js';
import photosBulkRemoveRouter from './routes/photosBulkRemove.js';
import removePhotoByEntityRouter from './routes/removePhotoByEntity.js';
import photosSearchRouter from './routes/photosSearch.js';
import suggestTitlesRouter from './routes/suggestTitles.js';
import tagsRouter from './routes/tags.js';
import suggestTagsRouter from './routes/suggestTags.js';
import tagsSyncFromCloudinaryRouter from './routes/tagsSyncFromCloudinary.js';
import photosUploadRouter from './routes/photosUpload.js';
import photosRouter from './routes/photos.js';
import rolesRouter from './routes/roles.js';
import statesRouter from './routes/states.js';
import tripsRouter from './routes/trips.js';
import userRolesRouter from './routes/userRoles.js';

const app = express();

app.use(cookieParser());
app.use(express.json({ limit: '16mb' }));

app.use(usersRouter);
app.use(changePasswordRouter);
app.use(userTokenRouter);
app.use(attractions);
app.use(login);
app.use(logoutRouter);
app.use(sessionRouter);
app.use(verifyTokenRouter);
app.use(checkInsRouter);
app.use(checkInMessagesRouter);
app.use(citiesRouter);
app.use(countriesRouter);
app.use(geocodeRouter);
app.use(infoRouter);
app.use(updateLocationVisitedRouter);
app.use(photosByEntityRouter);
app.use(addPhotoByEntityRouter);
app.use(photosBulkAddRouter);
app.use(photosBulkRemoveRouter);
app.use(removePhotoByEntityRouter);
app.use(photosSearchRouter);
app.use(suggestTitlesRouter);
app.use(tagsRouter);
app.use(suggestTagsRouter);
app.use(tagsSyncFromCloudinaryRouter);
app.use(photosUploadRouter);
app.use(photosRouter);
app.use(rolesRouter);
app.use(statesRouter);
app.use(tripsRouter);
app.use(userRolesRouter);

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
