import express from 'express';
import cookieParser from 'cookie-parser';

import userTokenRouter from './routes/userToken';
import usersRouter from './routes/users';
import changePasswordRouter from './routes/changePassword';
import attractions from './routes/attractions';
import login from './routes/login';
import logoutRouter from './routes/logout';
import sessionRouter from './routes/session';
import verifyTokenRouter from './routes/verifyToken';
import checkInsRouter from './routes/checkIns';
import checkInMessagesRouter from './routes/checkInMessages';
import citiesRouter from './routes/cities';
import countriesRouter from './routes/countries';
import geocodeRouter from './routes/geocode';
import infoRouter from './routes/info';
import updateLocationVisitedRouter from './routes/updateLocationVisited';
import photosByEntityRouter from './routes/photosByEntity';
import addPhotoByEntityRouter from './routes/addPhotoByEntity';
import photosBulkAddRouter from './routes/photosBulkAdd';
import photosBulkRemoveRouter from './routes/photosBulkRemove';
import removePhotoByEntityRouter from './routes/removePhotoByEntity';
import photosSearchRouter from './routes/photosSearch';
import suggestTitlesRouter from './routes/suggestTitles';
import tagsRouter from './routes/tags';
import suggestTagsRouter from './routes/suggestTags';
import tagsSyncFromCloudinaryRouter from './routes/tagsSyncFromCloudinary';
import photosUploadRouter from './routes/photosUpload';
import photosRouter from './routes/photos';
import rolesRouter from './routes/roles';
import statesRouter from './routes/states';
import tripsRouter from './routes/trips';
import userRolesRouter from './routes/userRoles';

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
