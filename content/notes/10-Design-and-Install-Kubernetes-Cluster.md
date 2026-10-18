## What this section is about
Choosing where and how to run Kubernetes, and what a production, highly available design looks like. The exam tests the *skills* (kubeadm, HA concepts) more than the design theory, but you should know the reasoning.

## Design questions
- **Purpose**: learning (Minikube/kind, single node), development (multi-node), production (HA control plane, multiple workers).
- **Where**: managed (EKS, GKE, AKS: provider runs the control plane) vs self-managed (kubeadm, kubespray) on cloud or bare metal.
- **Sizing**: up to roughly 5,000 nodes / 150,000 Pods / 300,000 containers is the documented scale envelope. Size control-plane and etcd disks (fast SSD) first; etcd is latency-sensitive.
- **Node OS**: a minimal Linux with a CRI runtime (containerd). Production: keep workloads off the control plane via the default taint.

## High availability
- Run **at least three** control-plane nodes (odd number for etcd quorum: quorum = ⌊n/2⌋+1; 3 nodes tolerate 1 failure, 5 tolerate 2).
- The API server is stateless and active-active: put a **load balancer** in front (`--control-plane-endpoint` at `kubeadm init`). Kubelets and kubectl use the LB address.
- The scheduler and controller-manager are **active/passive** with leader election through a lease.
- **etcd topologies**: *stacked* (etcd on the control-plane nodes; simpler, couples failures) vs *external* (separate etcd cluster; more nodes, more resilience).
- etcd uses the Raft consensus algorithm; writes need a quorum.

## Infrastructure to prepare
Unique hostname, MAC and product_uuid per node; swap disabled (or configured); required ports open (6443, 2379-2380, 10250, 10257, 10259, NodePort range); kernel modules `overlay` and `br_netfilter`; sysctls `net.bridge.bridge-nf-call-iptables=1` and `net.ipv4.ip_forward=1`; a container runtime with the systemd cgroup driver.

## Official documentation
- [Considerations for large clusters](https://kubernetes.io/docs/setup/best-practices/cluster-large/)
- [Options for Highly Available Topology](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/ha-topology/)
- [Creating Highly Available Clusters with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/)
- [Production environment](https://kubernetes.io/docs/setup/production-environment/), [Container Runtimes](https://kubernetes.io/docs/setup/production-environment/container-runtimes/)
- [Leases / leader election](https://kubernetes.io/docs/concepts/architecture/leases/)
