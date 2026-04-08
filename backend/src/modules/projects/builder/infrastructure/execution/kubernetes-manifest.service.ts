import { Injectable } from '@nestjs/common';

export interface ResourceLimits {
  cpuRequest: string;
  memoryRequest: string;
  cpuLimit: string;
  memoryLimit: string;
}

@Injectable()
export class KubernetesManifestService {
  renderBatchJobManifest(input: {
    namespace: string;
    jobName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
    timeoutSeconds: number;
    resources: ResourceLimits;
  }): string {
    const command = JSON.stringify(input.command);
    return [
      'apiVersion: batch/v1',
      'kind: Job',
      'metadata:',
      `  name: ${input.jobName}`,
      `  namespace: ${input.namespace}`,
      '  labels:',
      `    dockus/run-id: "${input.runId}"`,
      `    dockus/delivery-id: "${input.deliveryId}"`,
      '    dockus/managed-by: "builder-core"',
      'spec:',
      `  activeDeadlineSeconds: ${input.timeoutSeconds}`,
      '  template:',
      '    metadata:',
      '      labels:',
      `        dockus/run-id: "${input.runId}"`,
      `        dockus/delivery-id: "${input.deliveryId}"`,
      '        dockus/managed-by: "builder-core"',
      '    spec:',
      '      restartPolicy: Never',
      '      containers:',
      '        - name: app',
      `          image: ${input.imageTag}`,
      '          imagePullPolicy: IfNotPresent',
      `          command: ${command}`,
      '          resources:',
      '            requests:',
      `              cpu: "${input.resources.cpuRequest}"`,
      `              memory: "${input.resources.memoryRequest}"`,
      '            limits:',
      `              cpu: "${input.resources.cpuLimit}"`,
      `              memory: "${input.resources.memoryLimit}"`,
      '',
    ].join('\n');
  }

  renderServiceManifest(input: {
    namespace: string;
    deploymentName: string;
    serviceName: string;
    imageTag: string;
    port: number;
    runId: string;
    deliveryId: string;
    resources: ResourceLimits;
  }): string {
    return [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      `  name: ${input.deploymentName}`,
      `  namespace: ${input.namespace}`,
      '  labels:',
      `    dockus/run-id: "${input.runId}"`,
      `    dockus/delivery-id: "${input.deliveryId}"`,
      '    dockus/managed-by: "builder-core"',
      'spec:',
      '  replicas: 1',
      '  selector:',
      '    matchLabels:',
      `      app: ${input.deploymentName}`,
      '  template:',
      '    metadata:',
      '      labels:',
      `        app: ${input.deploymentName}`,
      `        dockus/run-id: "${input.runId}"`,
      `        dockus/delivery-id: "${input.deliveryId}"`,
      '        dockus/managed-by: "builder-core"',
      '    spec:',
      '      containers:',
      '        - name: app',
      `          image: ${input.imageTag}`,
      '          imagePullPolicy: IfNotPresent',
      '          ports:',
      `            - containerPort: ${input.port}`,
      '          resources:',
      '            requests:',
      `              cpu: "${input.resources.cpuRequest}"`,
      `              memory: "${input.resources.memoryRequest}"`,
      '            limits:',
      `              cpu: "${input.resources.cpuLimit}"`,
      `              memory: "${input.resources.memoryLimit}"`,
      '---',
      'apiVersion: v1',
      'kind: Service',
      'metadata:',
      `  name: ${input.serviceName}`,
      `  namespace: ${input.namespace}`,
      '  labels:',
      `    dockus/run-id: "${input.runId}"`,
      `    dockus/delivery-id: "${input.deliveryId}"`,
      '    dockus/managed-by: "builder-core"',
      'spec:',
      '  selector:',
      `    app: ${input.deploymentName}`,
      '  ports:',
      '    - protocol: TCP',
      `      port: ${input.port}`,
      `      targetPort: ${input.port}`,
      '  type: ClusterIP',
      '',
    ].join('\n');
  }
}
