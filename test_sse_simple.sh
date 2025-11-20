#!/bin/bash
# Simple test to reproduce SSE delivery issue using curl

API_BASE="http://127.0.0.1:8001"

# T Shape parameters (simplified)
T_SHAPE_PARAMS="magnafpm.RotorDiameter=2400&magnafpm.RotorTopology=Double&magnafpm.RotorDiskRadius=150&magnafpm.RotorDiskInnerRadius=103.25&magnafpm.RotorDiskThickness=10&magnafpm.MagnetLength=46&magnafpm.MagnetWidth=30&magnafpm.MagnetThickness=10&magnafpm.MagnetMaterial=NdFeB+N40&magnafpm.NumberMagnet=12&magnafpm.StatorThickness=13&magnafpm.CoilType=1&magnafpm.CoilLegWidth=21.5&magnafpm.CoilHoleWidthAtOuterRadius=30&magnafpm.CoilHoleWidthAtInnerRadius=30&magnafpm.MechanicalClearance=3&magnafpm.InnerDistanceBetweenMagnets=20&magnafpm.NumberOfCoilsPerPhase=3&magnafpm.WireWeight=2.6&magnafpm.WireDiameter=1.4&magnafpm.NumberOfWiresInHand=2&magnafpm.TurnsPerCoil=43&furling.VerticalPlaneAngle=20&furling.HorizontalPlaneAngle=55&furling.BracketLength=300&furling.BracketWidth=30&furling.BracketThickness=5&furling.BoomLength=1000&furling.BoomPipeDiameter=48.3&furling.BoomPipeThickness=3&furling.VaneThickness=6&furling.VaneLength=1200&furling.VaneWidth=500&furling.Offset=125&user.WindTurbineShape=Calculated&user.BladeWidth=124&user.HubPitchCircleDiameter=100&user.RotorDiskCentralHoleDiameter=65&user.HolesDiameter=12&user.MetalLengthL=50&user.MetalThicknessL=6&user.FlatMetalThickness=10&user.YawPipeDiameter=60.3&user.PipeThickness=5&user.RotorResinMargin=5&user.HubHolesDiameter=12"

# H Shape parameters (simplified)  
H_SHAPE_PARAMS="magnafpm.RotorDiameter=4200&magnafpm.RotorTopology=Double&magnafpm.RotorDiskRadius=225&magnafpm.RotorDiskInnerRadius=178.5&magnafpm.RotorDiskThickness=10&magnafpm.MagnetLength=46&magnafpm.MagnetWidth=30&magnafpm.MagnetThickness=10&magnafpm.MagnetMaterial=NdFeB+N40&magnafpm.NumberMagnet=16&magnafpm.StatorThickness=13&magnafpm.CoilType=1&magnafpm.CoilLegWidth=32&magnafpm.CoilHoleWidthAtOuterRadius=30&magnafpm.CoilHoleWidthAtInnerRadius=30&magnafpm.MechanicalClearance=3&magnafpm.InnerDistanceBetweenMagnets=36&magnafpm.NumberOfCoilsPerPhase=4&magnafpm.WireWeight=2.6&magnafpm.WireDiameter=1.4&magnafpm.NumberOfWiresInHand=2&magnafpm.TurnsPerCoil=43&furling.VerticalPlaneAngle=15&furling.HorizontalPlaneAngle=55&furling.BracketLength=600&furling.BracketWidth=50&furling.BracketThickness=6&furling.BoomLength=1800&furling.BoomPipeDiameter=48.3&furling.BoomPipeThickness=3&furling.VaneThickness=9&furling.VaneLength=2000&furling.VaneWidth=900&furling.Offset=250&user.WindTurbineShape=Calculated&user.BladeWidth=223&user.HubPitchCircleDiameter=130&user.RotorDiskCentralHoleDiameter=95&user.HolesDiameter=14&user.MetalLengthL=60&user.MetalThicknessL=6&user.FlatMetalThickness=10&user.YawPipeDiameter=88.9&user.PipeThickness=5&user.RotorResinMargin=5&user.HubHolesDiameter=14"

echo "🧪 Testing SSE Delivery Issue"
echo "Reproducing scenario where operations complete but results don't reach frontend"
echo ""

echo "📡 Test 1: Single T Shape operation (baseline)"
echo "Starting T Shape visualize..."
timeout 30 curl -N -s "${API_BASE}/api/visualize/WindTurbine/stream?${T_SHAPE_PARAMS}" | head -20 &
T_SHAPE_PID=$!

sleep 5

echo ""
echo "📡 Test 2: H Shape operation (should cancel T Shape)"  
echo "Starting H Shape visualize..."
timeout 30 curl -N -s "${API_BASE}/api/visualize/BladeTemplate/stream?${H_SHAPE_PARAMS}" | head -20 &
H_SHAPE_PID=$!

sleep 5

echo ""
echo "📡 Test 3: Multiple H Shape endpoints simultaneously"
echo "Starting H Shape CNC..."
timeout 30 curl -N -s "${API_BASE}/api/getcncoverview/stream?${H_SHAPE_PARAMS}" | head -10 &
CNC_PID=$!

echo "Starting H Shape Dimensions..."
timeout 30 curl -N -s "${API_BASE}/api/getdimensiontables/stream?${H_SHAPE_PARAMS}" | head -10 &
DIM_PID=$!

echo ""
echo "⏳ Waiting for operations to complete..."
wait

echo ""
echo "🏁 Test completed. Check backend logs for operation lifecycle."
