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
  OrderStatusBadge,
  Breadcrumb,
  MapView,
  MapPinIcon,
  WarehouseIcon,
  CheckCircleIcon,
  ClockIcon
} from "@skynav/ui";
import { DEMO_ORDERS, DEMO_DRONES, DEMO_WAREHOUSE } from "@/lib/demo-data";

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = DEMO_ORDERS.find((o) => o.id === id) || DEMO_ORDERS[0];
  const assignedDrone = DEMO_DRONES.find((d) => d.id === order.assignedDroneId);

  const breadcrumbs = [
    { label: "Dashboard", href: "/customer" },
    { label: "My Orders", href: "/customer/orders" },
    { label: order.orderNumber }
  ];

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
      id: "flight-corridor",
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
      <Breadcrumb items={breadcrumbs} />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">{order.orderNumber}</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Placed on {new Date(order.createdAt).toLocaleString()} • Recipient: {order.recipientName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/customer/tracking">
            <Button variant="primary" size="md">
              Open Fullscreen Radar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tactical Radar & Flight Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card variant="glass" className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>In-Flight Trajectory</CardTitle>
              <span className="text-xs font-mono text-cyan-400">{order.etaTime}</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-80 w-full">
                <MapView markers={mapMarkers} routes={mapRoutes} title="Active Mission Corridor" />
              </div>
            </CardContent>
          </Card>

          {/* Delivery Milestone Timeline */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Delivery Flight Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                <div className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-900" />
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-white">Order Placed & Airspace Corridor Validated</span>
                    <span className="text-[10px] font-mono text-slate-400">10:10 AM</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Airspace check passed. Geofences cleared.</p>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-900" />
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-white">Payload Loaded onto {order.assignedDroneCallsign || "SKY-001"}</span>
                    <span className="text-[10px] font-mono text-slate-400">10:12 AM</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Autonomous tether locked at Depot Alpha.</p>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-slate-900 animate-pulse" />
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-cyan-300">Ascended to Cruise Altitude (60m AGL)</span>
                    <span className="text-[10px] font-mono text-cyan-400">10:15 AM</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">En route along Waypoint Path Alpha-4.</p>
                </div>

                <div className="relative opacity-50">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-slate-700 ring-4 ring-slate-900" />
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-slate-300">Precision Touchdown & Drop Verification</span>
                    <span className="text-[10px] font-mono text-slate-500">Est. 10:42 AM</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Will hold at 2m altitude for recipient OTP entry.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Package Spec & Security OTP */}
        <div className="space-y-6">
          <Card variant="hud">
            <CardHeader>
              <CardTitle>Delivery Verification OTP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                Provide this secure 4-digit token to complete autonomous parcel drop.
              </p>
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 text-center font-mono shadow-lg shadow-cyan-950/40">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Release Code</div>
                <div className="text-4xl font-extrabold text-cyan-400 tracking-widest">{order.proofOfDeliveryCode}</div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <CardTitle>Package Manifest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Description</span>
                <span className="text-white font-sans">{order.packageDescription}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Weight</span>
                <span className="text-white">{order.weightKg.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Recipient Phone</span>
                <span className="text-white">{order.recipientPhone}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Address</span>
                <span className="text-white font-sans text-right max-w-[180px]">{order.deliveryAddress}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
