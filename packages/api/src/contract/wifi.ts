import { oc } from '@orpc/contract';
import z from 'zod';
import {
  wifiAuthLogListQuerySchema,
  wifiAuthLogSchema,
  wifiDeviceCreateSchema,
  wifiDeviceListQuerySchema,
  wifiDeviceSchema,
  wifiDeviceUpdateSchema,
  wifiIdParamSchema,
  wifiListQuerySchema,
  wifiNasCreateSchema,
  wifiNasSchema,
  wifiNasUpdateSchema,
  wifiRoleSpeedProfileCreateSchema,
  wifiRoleSpeedProfileSchema,
  wifiRoleSpeedProfileUpdateSchema,
  wifiSpeedProfileCreateSchema,
  wifiSpeedProfileSchema,
  wifiSpeedProfileUpdateSchema,
  wifiStringIdParamSchema,
  wifiUserCreateSchema,
  wifiUserSchema,
  wifiUserUpdateSchema,
} from '../domains/wifi/admin';
import {
  radiusAuthorizeRequestSchema,
  radiusAuthorizeResponseSchema,
} from '../domains/wifi/radius';
import {
  wifiSelfCreateResponseSchema,
  wifiSelfCreateSchema,
  wifiSelfDeviceSchema,
  wifiSelfDeviceUpdateSchema,
  wifiSelfPasswordChangeResponseSchema,
  wifiSelfPasswordChangeSchema,
} from '../domains/wifi/self';
import { wifiStatsOverviewSchema } from '../domains/wifi/stats';
import { wifiStatusResponseSchema } from '../domains/wifi/status';
import { filcRoute } from './route';

const TAGS = ['WiFi'];
const GROUP = 'WiFi';

export const wifiContract = {
  authLogs: {
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi auth logs.',
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiAuthLogs',
          path: '/wifi/auth-logs',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiAuthLogListResponse',
        })
      )
      .input(wifiAuthLogListQuerySchema)
      .output(z.object({ logs: z.array(wifiAuthLogSchema) })),
  },
  devices: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a WiFi device or global MAC ban.',
          group: GROUP,
          method: 'POST',
          operationId: 'postWifiDevices',
          path: '/wifi/devices',
          successStatus: 201,
          tags: TAGS,
          type: '@unit WifiDeviceResponse',
        })
      )
      .input(wifiDeviceCreateSchema)
      .output(z.object({ device: wifiDeviceSchema })),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi device or global MAC ban.',
          group: GROUP,
          method: 'DELETE',
          operationId: 'deleteWifiDevicesById',
          path: '/wifi/devices/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(wifiIdParamSchema)
      .output(z.object({ id: z.uuid() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi devices and global MAC bans.',
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiDevices',
          path: '/wifi/devices',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiDeviceListResponse',
        })
      )
      .input(wifiDeviceListQuerySchema)
      .output(z.object({ devices: z.array(wifiDeviceSchema) })),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi device or global MAC ban.',
          group: GROUP,
          method: 'PUT',
          operationId: 'putWifiDevicesById',
          path: '/wifi/devices/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiDeviceResponse',
        })
      )
      .input(wifiDeviceUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(z.object({ device: wifiDeviceSchema })),
  },
  nas: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Register a WiFi NAS device.',
          group: GROUP,
          method: 'POST',
          operationId: 'postWifiNas',
          path: '/wifi/nas',
          successStatus: 201,
          tags: TAGS,
          type: '@unit WifiNasResponse',
        })
      )
      .input(wifiNasCreateSchema)
      .output(z.object({ nas: wifiNasSchema })),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi NAS device.',
          group: GROUP,
          method: 'DELETE',
          operationId: 'deleteWifiNasById',
          path: '/wifi/nas/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(wifiIdParamSchema)
      .output(z.object({ id: z.uuid() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List authorized WiFi NAS devices.',
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiNas',
          path: '/wifi/nas',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiNasListResponse',
        })
      )
      .output(z.object({ nas: z.array(wifiNasSchema) })),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi NAS device.',
          group: GROUP,
          method: 'PUT',
          operationId: 'putWifiNasById',
          path: '/wifi/nas/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiNasResponse',
        })
      )
      .input(wifiNasUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(z.object({ nas: wifiNasSchema })),
  },
  radius: {
    authorize: oc
      .route(
        filcRoute({
          description: 'Authorize a WiFi client for FreeRADIUS.',
          group: GROUP,
          method: 'POST',
          operationId: 'postWifiRadiusAuthorize',
          path: '/wifi/radius/authorize',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiRadiusAuthorizeResponse',
        })
      )
      .input(radiusAuthorizeRequestSchema)
      .output(radiusAuthorizeResponseSchema),
  },
  roleSpeedProfiles: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a WiFi role speed-profile mapping.',
          group: GROUP,
          method: 'POST',
          operationId: 'postWifiRoleSpeedProfiles',
          path: '/wifi/role-speed-profiles',
          successStatus: 201,
          tags: TAGS,
          type: '@unit WifiRoleSpeedProfileResponse',
        })
      )
      .input(wifiRoleSpeedProfileCreateSchema)
      .output(z.object({ mapping: wifiRoleSpeedProfileSchema })),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi role speed-profile mapping.',
          group: GROUP,
          method: 'DELETE',
          operationId: 'deleteWifiRoleSpeedProfilesById',
          path: '/wifi/role-speed-profiles/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(wifiStringIdParamSchema)
      .output(z.object({ id: z.string() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi role speed-profile mappings.',
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiRoleSpeedProfiles',
          path: '/wifi/role-speed-profiles',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiRoleSpeedProfileListResponse',
        })
      )
      .output(
        z.object({ roleSpeedProfiles: z.array(wifiRoleSpeedProfileSchema) })
      ),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi role speed-profile mapping.',
          group: GROUP,
          method: 'PUT',
          operationId: 'putWifiRoleSpeedProfilesById',
          path: '/wifi/role-speed-profiles/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiRoleSpeedProfileResponse',
        })
      )
      .input(
        wifiRoleSpeedProfileUpdateSchema.extend(wifiStringIdParamSchema.shape)
      )
      .output(z.object({ mapping: wifiRoleSpeedProfileSchema })),
  },
  self: {
    certificate: oc
      .route(
        filcRoute({
          auth: true,
          description:
            "Download the CA certificate for the authenticated user's WiFi network.",
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiSelfCertificate',
          path: '/wifi/self/certificate',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .output(z.file()),
    changePassword: oc
      .route(
        filcRoute({
          auth: true,
          description: "Change the authenticated user's WiFi account password.",
          group: GROUP,
          method: 'PUT',
          operationId: 'putWifiSelfPassword',
          path: '/wifi/self/password',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(wifiSelfPasswordChangeSchema)
      .output(wifiSelfPasswordChangeResponseSchema),
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new WiFi account for the authenticated user.',
          group: GROUP,
          method: 'POST',
          operationId: 'postWifiSelf',
          path: '/wifi/self',
          successStatus: 201,
          tags: TAGS,
          type: '@unit WifiSelfCreateResponse @field(.wifi, WifiSelf)',
        })
      )
      .input(wifiSelfCreateSchema)
      .output(wifiSelfCreateResponseSchema),
    get: oc
      .route(
        filcRoute({
          auth: true,
          description: "Get the authenticated user's WiFi account and devices.",
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiSelf',
          path: '/wifi/self',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiSelfResponse @field(.wifi, WifiSelf)',
        })
      )
      .output(wifiSelfCreateResponseSchema),
    updateDevice: oc
      .route(
        filcRoute({
          auth: true,
          description: "Rename one of the authenticated user's WiFi devices.",
          group: GROUP,
          method: 'PUT',
          operationId: 'putWifiSelfDevicesById',
          path: '/wifi/self/devices/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiSelfDeviceResponse @field(.device, WifiSelfDevice)',
        })
      )
      .input(wifiSelfDeviceUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(z.object({ device: wifiSelfDeviceSchema })),
  },
  speedProfiles: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a UniFi WiFi speed profile.',
          group: GROUP,
          method: 'POST',
          operationId: 'postWifiSpeedProfiles',
          path: '/wifi/speed-profiles',
          successStatus: 201,
          tags: TAGS,
          type: '@unit WifiSpeedProfileResponse',
        })
      )
      .input(wifiSpeedProfileCreateSchema)
      .output(z.object({ profile: wifiSpeedProfileSchema })),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a UniFi WiFi speed profile.',
          group: GROUP,
          method: 'DELETE',
          operationId: 'deleteWifiSpeedProfilesById',
          path: '/wifi/speed-profiles/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(wifiStringIdParamSchema)
      .output(z.object({ id: z.string() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List UniFi WiFi speed profiles.',
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiSpeedProfiles',
          path: '/wifi/speed-profiles',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiSpeedProfileListResponse',
        })
      )
      .output(z.object({ speedProfiles: z.array(wifiSpeedProfileSchema) })),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a UniFi WiFi speed profile.',
          group: GROUP,
          method: 'PUT',
          operationId: 'putWifiSpeedProfilesById',
          path: '/wifi/speed-profiles/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiSpeedProfileResponse',
        })
      )
      .input(wifiSpeedProfileUpdateSchema.extend(wifiStringIdParamSchema.shape))
      .output(z.object({ profile: wifiSpeedProfileSchema })),
  },
  stats: {
    overview: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Get WiFi account, device, active-device, and auth statistics.',
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiStatsOverview',
          path: '/wifi/stats/overview',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiStatsResponse @field(.stats, WifiStats)',
        })
      )
      .output(wifiStatsOverviewSchema),
  },
  status: oc
    .route(
      filcRoute({
        description: 'Get the WiFi module status and configured SSID.',
        group: GROUP,
        method: 'GET',
        operationId: 'getWifiStatus',
        path: '/wifi/status',
        successStatus: 200,
        tags: TAGS,
        type: '@unit WifiStatusResponse',
      })
    )
    .output(wifiStatusResponseSchema),
  users: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a WiFi user account.',
          group: GROUP,
          method: 'POST',
          operationId: 'postWifiUsers',
          path: '/wifi/users',
          successStatus: 201,
          tags: TAGS,
          type: '@unit WifiUserResponse',
        })
      )
      .input(wifiUserCreateSchema)
      .output(z.object({ user: wifiUserSchema })),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi user account.',
          group: GROUP,
          method: 'DELETE',
          operationId: 'deleteWifiUsersById',
          path: '/wifi/users/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(wifiIdParamSchema)
      .output(z.object({ id: z.uuid() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi user accounts.',
          group: GROUP,
          method: 'GET',
          operationId: 'getWifiUsers',
          path: '/wifi/users',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiUserListResponse',
        })
      )
      .input(wifiListQuerySchema)
      .output(z.object({ users: z.array(wifiUserSchema) })),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi user account.',
          group: GROUP,
          method: 'PUT',
          operationId: 'putWifiUsersById',
          path: '/wifi/users/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit WifiUserResponse',
        })
      )
      .input(wifiUserUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(z.object({ user: wifiUserSchema })),
  },
};
