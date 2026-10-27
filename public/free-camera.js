export const FREE_CAMERA_COST=100;
export function payFreeCamera(economy,alreadyEnabled=false){if(alreadyEnabled)return {ok:true,charged:0};if(economy.rc<FREE_CAMERA_COST)return {ok:false,charged:0,message:'Free camera costs 100 RC each time you enter.'};economy.rc-=FREE_CAMERA_COST;economy.changed();return {ok:true,charged:FREE_CAMERA_COST}}
