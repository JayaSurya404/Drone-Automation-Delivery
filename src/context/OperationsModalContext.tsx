import React, { createContext, useContext, useState } from 'react';
import { CommandPalette } from '../components/common/CommandPalette';
import { DigitalTwinModal } from '../components/drone/DigitalTwinModal';
import { MissionReplayModal } from '../components/operations/MissionReplayModal';
import { SimulationCenterModal } from '../components/operations/SimulationCenterModal';

interface OperationsModalContextType {
  openCommandPalette: () => void;
  openDigitalTwin: (droneId?: string) => void;
  openMissionReplay: (missionId?: string) => void;
  openSimulation: (scenarioId?: string) => void;
}

const OperationsModalContext = createContext<OperationsModalContextType | undefined>(undefined);

export const OperationsModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [digitalTwinDroneId, setDigitalTwinDroneId] = useState<string | null>(null);
  const [missionReplayId, setMissionReplayId] = useState<string | null>(null);
  const [simulationScenarioId, setSimulationScenarioId] = useState<string | null>(null);

  const openCommandPalette = () => setIsCommandPaletteOpen(true);
  const openDigitalTwin = (droneId = 'D-001') => setDigitalTwinDroneId(droneId);
  const openMissionReplay = (missionId = 'MS-10284') => setMissionReplayId(missionId);
  const openSimulation = (scenarioId = 'deviation') => setSimulationScenarioId(scenarioId);

  return (
    <OperationsModalContext.Provider
      value={{
        openCommandPalette,
        openDigitalTwin,
        openMissionReplay,
        openSimulation,
      }}
    >
      {children}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenDigitalTwin={openDigitalTwin}
        onOpenSimulation={openSimulation}
        onOpenMissionReplay={openMissionReplay}
      />

      {/* Global Digital Twin Modal */}
      {digitalTwinDroneId && (
        <DigitalTwinModal
          isOpen={!!digitalTwinDroneId}
          droneId={digitalTwinDroneId}
          onClose={() => setDigitalTwinDroneId(null)}
        />
      )}

      {/* Global Mission Replay Modal */}
      {missionReplayId && (
        <MissionReplayModal
          isOpen={!!missionReplayId}
          missionId={missionReplayId}
          onClose={() => setMissionReplayId(null)}
        />
      )}

      {/* Global Simulation Center Modal */}
      {simulationScenarioId !== null && (
        <SimulationCenterModal
          isOpen={simulationScenarioId !== null}
          initialScenario={simulationScenarioId || 'deviation'}
          onClose={() => setSimulationScenarioId(null)}
        />
      )}
    </OperationsModalContext.Provider>
  );
};

export const useOperationsModals = () => {
  const ctx = useContext(OperationsModalContext);
  if (!ctx) throw new Error('useOperationsModals must be used within OperationsModalProvider');
  return ctx;
};
