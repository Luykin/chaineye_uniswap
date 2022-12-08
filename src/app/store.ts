import type { Middleware } from '@reduxjs/toolkit'
import { configureStore, isRejectedWithValue } from '@reduxjs/toolkit'
import { MMKV } from 'react-native-mmkv'
import { persistReducer, persistStore, Storage } from 'redux-persist'
import createSagaMiddleware from 'redux-saga'
import createMigrate from 'src/app/createMigrate'
import { migrations } from 'src/app/migrations'
import { rootReducer } from 'src/app/rootReducer'
import { rootSaga } from 'src/app/rootSaga'
import { walletContextValue } from 'src/app/walletContext'
import { config } from 'src/config'
import { ensApi } from 'src/features/ens/api'
import { fiatOnRampApi } from 'src/features/fiatOnRamp/api'
import { forceUpgradeApi } from 'src/features/forceUpgrade/forceUpgradeApi'
import { gasApi } from 'src/features/gas/api'
import { routingApi } from 'src/features/routing/routingApi'
import { trmApi } from 'src/features/trm/api'
import { logger } from 'src/utils/logger'

const storage = new MMKV()

export const reduxStorage: Storage = {
  setItem: (key, value) => {
    storage.set(key, value)
    return Promise.resolve(true)
  },
  getItem: (key) => {
    const value = storage.getString(key)
    return Promise.resolve(value)
  },
  removeItem: (key) => {
    storage.delete(key)
    return Promise.resolve()
  },
}

const sagaMiddleware = createSagaMiddleware({
  context: {
    signers: walletContextValue.signers,
    providers: walletContextValue.providers,
    contracts: walletContextValue.contracts,
  },
})

const rtkQueryErrorLogger: Middleware = () => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    logger.error('store', 'rtkQueryErrorLogger', JSON.stringify(action.payload ?? action.error))
  }

  return next(action)
}

export const persistConfig = {
  key: 'root',
  storage: reduxStorage,
  whitelist: [
    'biometricSettings',
    'chains',
    'experiments',
    'favorites',
    'notifications',
    'passwordLockout',
    'searchHistory',
    'tokenLists',
    'tokens',
    'transactions',
    'wallet',
    ensApi.reducerPath,
    trmApi.reducerPath,
  ],
  version: 28,
  migrate: createMigrate(migrations),
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

const middlewares: Middleware[] = []
if (__DEV__) {
  const createDebugger = require('redux-flipper').default
  middlewares.push(createDebugger())
}

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // required for rtk-query
      thunk: true,
      // turn off since it slows down for dev and also doesn't run in prod
      // TODO: figure out why this is slow: MOB-681
      serializableCheck: false,
      invariantCheck: {
        warnAfter: 256,
      },
      // slows down dev build considerably
      immutableCheck: false,
    }).concat(
      ensApi.middleware,
      fiatOnRampApi.middleware,
      forceUpgradeApi.middleware,
      gasApi.middleware,
      routingApi.middleware,
      trmApi.middleware,
      sagaMiddleware,
      rtkQueryErrorLogger,
      ...middlewares
    ),
  devTools: config.debug,
})

export const persistor = persistStore(store)
sagaMiddleware.run(rootSaga)

export type AppDispatch = typeof store.dispatch