import * as Keychain from 'react-native-keychain';
const SERVICE='valor.technician.tokens';
export const tokenStorage={async getAccessToken(){const c=await Keychain.getGenericPassword({service:SERVICE});return c?c.password:null},async saveAccessToken(token:string){await Keychain.setGenericPassword('access-token',token,{service:SERVICE})},async clear(){await Keychain.resetGenericPassword({service:SERVICE})}};
