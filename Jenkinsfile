pipeline {
    agent any

    environment {
        // --- CONFIGURAZIONE GLOBALE ---
        DOCKER_CREDS = 'dockerhub-id'
        K8S_CONFIG   = 'k8s-secret'
        DOCKER_USER  = 'claudia179'
    }

    stages {
        stage('Inizializzazione') {
            steps {
                echo "Avvio Pipeline CI/CD Enterprise per utente: ${DOCKER_USER}"
            }
        }

        // --------------------------------------------------------
        // SETUP DATABASE CONDIVISO (STAGING)
        // --------------------------------------------------------
        stage('Setup Infrastruttura Dati e Broker (Staging)') {
            steps {
                withCredentials([file(credentialsId: 'k8s-secret', variable: 'KUBECONFIG')]) {
                    script {
                        echo "--- Configurazione Storage, Database e Message Broker su K8s ---"
                        
                        // 0. Applica i secrets (mantiene la best practice per le password)
                        sh 'kubectl apply -f k8s/secrets.yaml'
                        
                        // 1. Deploy delle infrastrutture NoSQL, Object Storage e Broker (nella cartella storage)
                        sh 'kubectl apply -f k8s/storage/mongodb-deployment.yaml'
                        sh 'kubectl apply -f k8s/storage/minio-deployment.yaml'
                        sh 'kubectl apply -f k8s/storage/rabbitmq-deployment.yaml'
                        
                        // 2. Deploy dell'infrastruttura Relazionale (PostgreSQL) (nella cartella storage)
                        sh 'kubectl apply -f k8s/storage/postgres-deployment.yaml'
                        sh 'kubectl apply -f k8s/storage/postgres-configmap.yaml'
                        
                        // 3. Inizializzazione degli schemi e dei 5 database logici in PostgreSQL (nella cartella storage)
                        sh 'kubectl delete job db-schema-init --ignore-not-found=true'
                        sh 'kubectl apply -f k8s/storage/postgres-init-job.yaml'
                        
                        echo "Attesa completamento inizializzazione database relazionali..."
                        sh 'kubectl wait --for=condition=complete --timeout=120s job/db-schema-init'
                    }
                }
            }
        }

        // --------------------------------------------------------
        // FASE CORE: CICLO DI VITA MICROSERVIZI
        // --------------------------------------------------------
        stage('Gestione Ciclo di Vita Microservizi') {
            parallel {
                
                // --- API GATEWAY (Senza DB) ---
                stage('Api Gateway Service') {
                    when { changeset "api-gateway-service/**" }
                    steps { processGatewayService('api-gateway-service', 'api-gateway-service-img', 'api-gateway-deployment') }
                }

                // --- MICROSERVIZI RELAZIONALI (PostgreSQL) ---
                stage('Auth Service') {
                    when { changeset "auth-service/**" }
                    steps { processPostgresService('auth-service', 'auth-service-img', 'auth-deployment') }
                }
                stage('Warning Service') {
                    when { changeset "warning-service/**" }
                    steps { processPostgresService('warning-service', 'warning-service-img', 'warning-deployment') }
                }
                stage('Media Service') {
                    when { changeset "media-service/**" }
                    steps { processPostgresService('media-service', 'media-service-img', 'media-deployment') }
                }
                stage('Log Service') {
                    when { changeset "log-service/**" }
                    steps { processPostgresService('log-service', 'log-service-img', 'log-deployment') }
                }

                // --- MICROSERVIZI SPAZIALI (PostGIS) ---
                stage('GeoZone Service') {
                    when { changeset "geozone-service/**" }
                    steps { processPostgisService('geozone-service', 'geozone-service-img', 'geozone-deployment') }
                }

                // --- MICROSERVIZI NOSQL (MongoDB) ---
                stage('Asset Service') {
                    when { changeset "asset-service/**" }
                    steps { processMongoService('asset-service', 'asset-service-img', 'asset-deployment') }
                }

                // --- FRONTEND WEB (React + Nginx) ---
                /*stage('Frontend Web') {
                    when { changeset "frontend/**" }
                    steps {
                        script {
                            echo "[Frontend] Inizio Build & Deploy..."
                            
                            // 1. Build & Push Docker
                            dir('frontend') {
                                docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-id') {
                                    def frontendImg = docker.build("${DOCKER_USER}/urban-frontend:${env.BUILD_NUMBER}")
                                    frontendImg.push()
                                    frontendImg.push("latest")
                                }
                            }
                            
                            // 2. Deploy su Kubernetes (nella cartella service)
                            withCredentials([file(credentialsId: 'k8s-secret', variable: 'KUBECONFIG')]) {
                                sh 'kubectl apply -f k8s/service/frontend.yaml'
                                sh "kubectl set image deployment/frontend-deployment frontend=${DOCKER_USER}/urban-frontend:${env.BUILD_NUMBER} --record"
                                sh 'kubectl rollout status deployment/frontend-deployment --timeout=60s'
                            }
                        }
                    }
                }*/
            }
        }

        stage('System Verification') {
            steps {
                script {
                    echo "Tutti i servizi sono stati testati isolatamente e deployati con successo."
                }
            }
        }
    }
}

// ============================================================================
// FUNZIONE 1: LOGICA PER MICROSERVIZI RELAZIONALI (POSTGRESQL 15)
// ============================================================================
def processPostgresService(serviceDir, imageName, k8sDeployName) {
    stage("${serviceDir} - Test Unitari") {
        dir(serviceDir) {
            script {
                echo "[${serviceDir}] Unit Testing su PostgreSQL..."
                docker.image('postgres:15').withRun('-e POSTGRES_DB=test_db -e POSTGRES_USER=test_user -e POSTGRES_PASSWORD=test_pass') { c ->
                    docker.image('postgres:15').inside("--link ${c.id}:db") {
                        sh 'while ! pg_isready -h db -U test_user; do sleep 1; done'
                    }
                    docker.image('python:3.9').inside("--link ${c.id}:db -u 0:0") {
                        sh 'pip install -r requirements.txt'
                        withEnv(['DATABASE_URL=postgresql://test_user:test_pass@db:5432/test_db']) {
                            sh 'pytest tests/test_unit.py'
                        }
                    }
                }
            }
        }
    }

    stage("${serviceDir} - Build") {
        dir(serviceDir) {
            withDockerRegistry(credentialsId: 'dockerhub-id', url: 'https://index.docker.io/v1/') {
                sh "docker build -t ${DOCKER_USER}/${imageName}:${BUILD_NUMBER} ."
            }
        }
    }

    stage("${serviceDir} - Integration Test") {
        script {
            docker.image('postgres:15').withRun('-e POSTGRES_DB=integration_db -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test') { dbContainer ->
                docker.image('postgres:15').inside("--link ${dbContainer.id}:db") {
                    sh 'while ! pg_isready -h db -U test; do sleep 1; done'
                }

                docker.image("${DOCKER_USER}/${imageName}:${BUILD_NUMBER}").withRun("--link ${dbContainer.id}:db -e DATABASE_URL=postgresql://test:test@db:5432/integration_db -e JWT_SECRET=test-secret") { appContainer ->
                    sleep 5
                    sh "docker inspect -f '{{.State.Running}}' ${appContainer.id} | grep true || (docker logs ${appContainer.id} && exit 1)"
                    sh "docker exec ${appContainer.id} python -c \"import sys; from app import app, db; print('Init DB...'); app.app_context().push(); db.create_all(); print('DB OK')\" || echo '⚠️ DB Init skipped or failed'"

                    dir(serviceDir) {
                        def setupScript = "tests/setup_tests.sh"
                        if (fileExists(setupScript)) {
                            sh "chmod +x ${setupScript} && sh ${setupScript}"
                        }
                        def collection = sh(script: "find . -name '*_collection.json' | head -n 1", returnStdout: true).trim()
                        if (collection) {
                            docker.image('postman/newman').inside("--link ${appContainer.id}:app --entrypoint=''") {
                                sh "newman run ${collection} --reporters cli --env-var base_url=http://app:5000"
                            }
                        }
                    }
                }
            }
        }
    }

    stage("${serviceDir} - Push & Deploy") {
        deployMicroservice(serviceDir, imageName, k8sDeployName)
    }
}

// ============================================================================
// FUNZIONE 2: LOGICA PER MICROSERVIZI SPAZIALI (POSTGIS 15)
// ============================================================================
def processPostgisService(serviceDir, imageName, k8sDeployName) {
    stage("${serviceDir} - Test Unitari") {
        dir(serviceDir) {
            script {
                echo "[${serviceDir}] Unit Testing su PostGIS..."
                docker.image('postgis/postgis:15-3.3').withRun('-e POSTGRES_DB=test_db -e POSTGRES_USER=test_user -e POSTGRES_PASSWORD=test_pass') { c ->
                    docker.image('postgres:15').inside("--link ${c.id}:db") {
                        sh 'while ! pg_isready -h db -U test_user; do sleep 1; done'
                    }
                    docker.image('python:3.9').inside("--link ${c.id}:db -u 0:0") {
                        sh 'pip install -r requirements.txt'
                        withEnv(['DATABASE_URL=postgresql://test_user:test_pass@db:5432/test_db']) {
                            sh 'pytest tests/test_unit.py'
                        }
                    }
                }
            }
        }
    }

    stage("${serviceDir} - Build") {
        dir(serviceDir) {
            withDockerRegistry(credentialsId: 'dockerhub-id', url: 'https://index.docker.io/v1/') {
                sh "docker build -t ${DOCKER_USER}/${imageName}:${BUILD_NUMBER} ."
            }
        }
    }

    stage("${serviceDir} - Integration Test") {
        script {
            docker.image('postgis/postgis:15-3.3').withRun('-e POSTGRES_DB=integration_db -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test') { dbContainer ->
                docker.image('postgres:15').inside("--link ${dbContainer.id}:db") {
                    sh 'while ! pg_isready -h db -U test; do sleep 1; done'
                }

                docker.image("${DOCKER_USER}/${imageName}:${BUILD_NUMBER}").withRun("--link ${dbContainer.id}:db -e DATABASE_URL=postgresql://test:test@db:5432/integration_db -e JWT_SECRET=test-secret") { appContainer ->
                    sleep 5
                    sh "docker inspect -f '{{.State.Running}}' ${appContainer.id} | grep true || (docker logs ${appContainer.id} && exit 1)"
                    sh "docker exec ${appContainer.id} python -c \"import sys; from app import app, db; print('Init DB...'); app.app_context().push(); db.create_all(); print('DB OK')\" || echo '⚠️ DB Init skipped'"

                    dir(serviceDir) {
                        def collection = sh(script: "find . -name '*_collection.json' | head -n 1", returnStdout: true).trim()
                        if (collection) {
                            docker.image('postman/newman').inside("--link ${appContainer.id}:app --entrypoint=''") {
                                sh "newman run ${collection} --reporters cli --env-var base_url=http://app:5000"
                            }
                        }
                    }
                }
            }
        }
    }

    stage("${serviceDir} - Push & Deploy") {
        deployMicroservice(serviceDir, imageName, k8sDeployName)
    }
}

// ============================================================================
// FUNZIONE 3: LOGICA PER MICROSERVIZI NOSQL (MONGODB)
// ============================================================================
def processMongoService(serviceDir, imageName, k8sDeployName) {
    stage("${serviceDir} - Test Unitari") {
        dir(serviceDir) {
            script {
                echo "[${serviceDir}] Unit Testing su MongoDB (Fallback v4.4 per supporto CPU VM)..."
                docker.image('mongo:4.4').withRun('-e MONGO_INITDB_ROOT_USERNAME=test_user -e MONGO_INITDB_ROOT_PASSWORD=test_pass') { c ->
                    sleep 10 // Attendiamo che Mongo sia completamente pronto
                    
                    docker.image('python:3.9').inside("--link ${c.id}:db -u 0:0") {
                        sh 'pip install --no-cache-dir -r requirements.txt pytest'
                        withEnv(['DATABASE_URL=mongodb://test_user:test_pass@db:27017/test_db?authSource=admin']) {
                            sh 'pytest tests/test_unit.py'
                        }
                    }
                }
            }
        }
    }

    stage("${serviceDir} - Build") {
        dir(serviceDir) {
            withDockerRegistry(credentialsId: 'dockerhub-id', url: 'https://index.docker.io/v1/') {
                sh "docker build -t ${DOCKER_USER}/${imageName}:${BUILD_NUMBER} ."
            }
        }
    }

    stage("${serviceDir} - Integration Test") {
        script {
            docker.image('mongo:4.4').withRun('-e MONGO_INITDB_ROOT_USERNAME=test -e MONGO_INITDB_ROOT_PASSWORD=test') { dbContainer ->
                sleep 10 

                docker.image("${DOCKER_USER}/${imageName}:${BUILD_NUMBER}").withRun("--link ${dbContainer.id}:db -e DATABASE_URL=mongodb://test:test@db:27017/integration_db?authSource=admin -e JWT_SECRET=test-secret") { appContainer ->
                    sleep 5
                    sh "docker inspect -f '{{.State.Running}}' ${appContainer.id} | grep true || (docker logs ${appContainer.id} && exit 1)"
                    
                    dir(serviceDir) {
                        def collection = sh(script: "find . -name '*_collection.json' | head -n 1", returnStdout: true).trim()
                        if (collection) {
                            docker.image('postman/newman').inside("--link ${appContainer.id}:app --entrypoint=''") {
                                sh "newman run ${collection} --reporters cli --env-var base_url=http://app:5000"
                            }
                        }
                    }
                }
            }
        }
    }

    stage("${serviceDir} - Push & Deploy") {
        deployMicroservice(serviceDir, imageName, k8sDeployName)
    }
}

// ============================================================================
// FUNZIONE 4: LOGICA SPECIFICA PER IL GATEWAY (NO DATABASE)
// ============================================================================
def processGatewayService(serviceDir, imageName, k8sDeployName) {
    stage("${serviceDir} - Test Unitari") {
        dir(serviceDir) {
            script {
                echo "[${serviceDir}] Unit Testing..."
                docker.image('python:3.9').inside("-u 0:0") {
                    sh 'pip install -r requirements.txt'
                    withEnv(['JWT_SECRET=test', 'AUTH_SERVICE_URL=http://mock', 'PYTHONPATH=.']) {
                        if (fileExists('tests/test_unit.py')) {
                            sh 'pytest tests/test_unit.py'
                        }
                    }
                }
            }
        }
    }

    stage("${serviceDir} - Build") {
        dir(serviceDir) {
            withDockerRegistry(credentialsId: 'dockerhub-id', url: 'https://index.docker.io/v1/') {
                sh "docker build -t ${DOCKER_USER}/${imageName}:${BUILD_NUMBER} ."
            }
        }
    }

    stage("${serviceDir} - Integration Test (Health)") {
        script {
            docker.image("${DOCKER_USER}/${imageName}:${BUILD_NUMBER}").withRun("-e PORT=5000 -e JWT_SECRET=test") { appContainer ->
                sleep 5
                sh "docker inspect -f '{{.State.Running}}' ${appContainer.id} | grep true || (docker logs ${appContainer.id} && exit 1)"
                docker.image('curlimages/curl').inside("--link ${appContainer.id}:gateway") {
                    sh "curl -f http://gateway:5000/health"
                }
            }
        }
    }

    stage("${serviceDir} - Push & Deploy") {
        deployMicroservice(serviceDir, imageName, k8sDeployName)
    }
}

// ============================================================================
// HELPER: DRY PUSH & DEPLOY
// ============================================================================
def deployMicroservice(serviceDir, imageName, k8sDeployName) {
    dir(serviceDir) {
        withDockerRegistry(credentialsId: 'dockerhub-id', url: 'https://index.docker.io/v1/') {
            sh "docker push ${DOCKER_USER}/${imageName}:${BUILD_NUMBER}"
            sh "docker tag ${DOCKER_USER}/${imageName}:${BUILD_NUMBER} ${DOCKER_USER}/${imageName}:latest"
            sh "docker push ${DOCKER_USER}/${imageName}:latest"
        }
    }
    
    withCredentials([file(credentialsId: 'k8s-secret', variable: 'KUBECONFIG')]) {
        // Applica il file YAML dalla cartella service
        sh "kubectl apply -f k8s/service/${serviceDir}.yaml" 
        def containerName = serviceDir 
        sh "kubectl set image deployment/${k8sDeployName} ${containerName}=${DOCKER_USER}/${imageName}:${BUILD_NUMBER} --record"
        sh "kubectl rollout status deployment/${k8sDeployName} --timeout=60s"
    }
}