import React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  DroneIcon,
  PackageIcon,
  RadarIcon,
  ClockIcon,
  MapPinIcon,
  ChevronRightIcon,
  OrderStatusBadge,
  MapView
} from "@skynav/ui";
import { DEMO_ORDERS, DEMO_DRONES, DEMO_WAREHOUSE } from "@/lib/demo-data";

export default function CustomerDashboard() {
  const activeOrder = DEMO_ORDERS.find((o) => o.status === "IN_TRANSIT") || DEMO_ORDERS[0];
  const assignedDrone = DEMO_DRONES.find((d) => d.id === activeOrder.assignedDroneId);

  // Map markers for active customer order
  const mapMarkers = [
    {
      id: "depot",
      type: "warehouse" as const,
      latitude: DEMO_WAREHOUSE.latitude,
      longitude: DEMO_WAREHOUSE.longitude,
      title: "Depot Alpha"
    },
    {
      id: "dest",
      type: "destination" as const,
      latitude: 37.7952,
      longitude: -122.4028,
      title: "Delivery Landing Zone"
    },
    ...(assignedDrone
      ? [
          {
            id: assignedDrone.id,
            type: "drone" as const,
            latitude: assignedDrone.latitude,
            longitude: assignedDrone.longitude,
            headingDegrees: assignedDrone.headingDegrees,
            altitudeMeters: assignedDrone.altitudeMeters,
            batteryPercent: assignedDrone.batteryPercent,
            title: assignedDrone.callsign,
            status: assignedDrone.status
          }
        ]
      : [])
  ];

  const mapRoutes = [
    {
      id: "delivery-corridor",
      coordinates: [
        { latitude: DEMO_WAREHOUSE.latitude, longitude: DEMO_WAREHOUSE.longitude },
        { latitude: 37.785, longitude: -122.41 },
        { latitude: 37.7952, longitude: -122.4028 }
      ],
      color: "#00f0ff"
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-950 border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Welcome back, Dr. Evelyn Reed</h2>
          <p className="text-xs text-slate-400 mt-1">
            You have <strong className="text-cyan-400">1 active aerial shipment</strong> in flight to Montgomery St.
          </p>
        </div>
        <Link href="/customer/orders">
          <Button variant="primary" size="md" rightIcon={<ChevronRightIcon size={14} />}>
            Create Delivery Order
          </Button>
        </Link>
      </div>

      {/* Active Airborne Delivery Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card variant="glass" className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 text-cyan-400 border border-cyan-500/30">
                  <DroneIcon size={22} />
                </div>
                <div>
                  <CardTitle className="text-lg">Live Delivery Tracking // {activeOrder.orderNumber}</CardTitle>
                  <span className="text-xs text-slate-400 font-mono">Assigned UAV: {activeOrder.assignedDroneCallsign}</span>
                </div>
              </div>
              <OrderStatusBadge status={activeOrder.status} />
            </CardHeader>

            <CardContent className="p-0">
              {/* Tactical Map Viewport */}
              <div className="h-72 w-full">
                <MapView
                  markers={mapMarkers}
                  routes={mapRoutes}
                  title="In-Flight Corridor Tracking"
                  showControls={false}
                />
              </div>

              {/* Progress and Details Bar */}
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800 bg-slate-950/60 font-mono text-center">
                <div>
                  <div className="text-[10px] text-slate-400">ESTIMATED ARRIVAL</div>
                  <div className="text-sm font-bold text-cyan-300">{activeOrder.etaTime}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">ALTITUDE</div>
                  <div className="text-sm font-bold text-white">{assignedDrone?.altitudeMeters || 58} m</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">GROUND SPEED</div>
                  <div className="text-sm font-bold text-white">{assignedDrone?.speedMetersPerSecond || 15.2} m/s</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">RELEASE OTP</div>
                  <div className="text-sm font-bold text-emerald-400">{activeOrder.proofOfDeliveryCode}</div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <MapPinIcon size={14} className="text-cyan-400" />
                <span>Destination: {activeOrder.deliveryAddress}</span>
              </div>
              <Link href={`/customer/orders/${activeOrder.id}`}>
                <Button variant="outline" size="sm">
                  View Flight Manifest →
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Quick Status & Recent Orders */}
        <div className="space-y-6">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Delivery Security Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                When drone <strong>{activeOrder.assignedDroneCallsign}</strong> touches down at your landing pad, provide the 4-digit code to complete tether release.
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Verification Code</div>
                <div className="text-3xl font-extrabold text-cyan-400 tracking-widest">{activeOrder.proofOfDeliveryCode}</div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>Recent Orders</CardTitle>
              <Link href="/customer/orders" className="text-xs text-cyan-400 hover:underline font-medium">
                View All
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-slate-800/60 p-0">
              {DEMO_ORDERS.slice(1, 3).map((order) => (
                <Link
                  key={order.id}
                  href={`/customer/orders/${order.id}`}
                  className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors block"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-200">{order.orderNumber}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      {order.packageDescription}
                    </span>
                  </div>
                  <OrderStatusBadge status={order.status} size="sm" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
