<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Models\BackupReport;
use App\Modules\Operations\Models\ScheduledTaskRun;
use App\Shared\Audit\AuditLog;
use Illuminate\Console\Events\ScheduledTaskFailed;
use Illuminate\Console\Events\ScheduledTaskFinished;
use Illuminate\Console\Events\ScheduledTaskStarting;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Cache::flush();
    config(['operations.gotenberg_url' => '', 'queue.default' => 'sync']);
    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->ingenierie = C::operateur(['engineering'], 'Eve Engineering');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->facturation = C::operateur(['billing'], 'Bill Billing');
    $this->sauvegarde = function (string $type = 'database', ?DateTimeInterface $debut = null, bool $reussie = true): BackupReport {
        return BackupReport::query()->create([
            'kind' => $type,
            'started_at' => $debut ?? now()->subHours(2),
            'duration_seconds' => 120,
            'size_bytes' => 4096,
            'succeeded' => $reussie,
            'manifest_sha256' => str_repeat('a', 64),
        ]);
    };
    $this->tache = fn (string $commande = 'privacy:flag-due', string $cron = '0 7 * * *') => app(Schedule::class)->command($commande)->cron($cron);
});

$routes = ['/api/v1/console/health', '/api/v1/console/backups', '/api/v1/console/settings'];

foreach ($routes as $route) {
    it("refuse {$route} sans jeton", function () use ($route): void {
        C::reinitialiser($this);
        $this->getJson($route)->assertUnauthorized();
    });

    it("refuse {$route} aux rôles conformité et facturation", function () use ($route): void {
        C::lire($this, $this->conformite['jeton'], $route)->assertForbidden();
        C::lire($this, $this->facturation['jeton'], $route)->assertForbidden();
    });

    it("refuse {$route} à un jeton d'agence", function () use ($route): void {
        $organisation = T::organisation('Agence du Port');
        C::reinitialiser($this);
        $this->actingAs(User::factory()->create(), 'sanctum')->getJson($route)->assertForbidden();
        expect($organisation->id)->not->toBeEmpty();
    });

    it("sert {$route} à l'administrateur, au support et à l'ingénierie", function () use ($route): void {
        foreach (['admin', 'support', 'ingenierie'] as $cle) {
            C::lire($this, $this->{$cle}['jeton'], $route)->assertOk();
            Cache::flush();
        }
    });
}

it('rend les composants attendus avec un état parmi ok, down ou unknown', function (): void {
    $reponse = C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertOk();

    expect(array_keys($reponse->json('data.components')))->toBe(['database', 'queue', 'scheduler', 'antivirus', 'pdf', 'mail', 'payments', 'backups'])
        ->and($reponse->json('data.status'))->toBeIn(['ok', 'down', 'unknown'])
        ->and($reponse->json('data.components.database.state'))->toBe('ok')
        ->and($reponse->json('data'))->toHaveKeys(['status', 'checked_at', 'components', 'links']);

    foreach ($reponse->json('data.components') as $composant) {
        expect($composant['state'])->toBeIn(['ok', 'down', 'unknown']);
    }
});

it('ne fuit aucun hôte, chemin, secret ni version dans la santé et les réglages', function (): void {
    config(['operations.gotenberg_url' => 'http://gotenberg-interne:3000']);
    Http::fake(['*' => Http::response('ok', 200)]);

    $sante = C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->getContent();
    $reglages = C::lire($this, $this->admin['jeton'], '/api/v1/console/settings')->getContent();

    foreach ([$sante, $reglages] as $corps) {
        expect($corps)->not->toContain('gotenberg-interne')
            ->and($corps)->not->toContain('console_relay_key')
            ->and($corps)->not->toContain((string) config('app.key'))
            ->and($corps)->not->toContain(base_path());
    }
});

it('affiche les liens de supervision seulement quand ils sont configurés', function (): void {
    C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertJsonPath('data.links', ['monitoring_url' => null, 'status_page_url' => null]);

    Cache::flush();
    config(['operations.monitoring_url' => 'https://supervision.example.test', 'operations.status_page_url' => 'https://statut.example.test']);

    C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertJsonPath('data.links.monitoring_url', 'https://supervision.example.test')->assertJsonPath('data.links.status_page_url', 'https://statut.example.test');
});

it('sonde le PDF : ok, down sur 5xx, unknown sans configuration ou sur 404', function (): void {
    config(['operations.gotenberg_url' => 'http://gotenberg.test']);

    $etat = function (): string {
        Cache::flush();

        return C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->json('data.components.pdf.state');
    };

    $code = 200;
    Http::fake(function () use (&$code) {
        return Http::response('', $code);
    });
    expect($etat())->toBe('ok');

    $code = 503;
    expect($etat())->toBe('down');

    $code = 404;
    expect($etat())->toBe('unknown');

    config(['operations.gotenberg_url' => '']);
    expect($etat())->toBe('unknown');
});

it('garde la santé 30 secondes en cache', function (): void {
    config(['operations.gotenberg_url' => 'http://gotenberg.test']);
    Http::fake(['gotenberg.test/*' => Http::response('', 200)]);

    C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertOk();
    C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertOk();

    Http::assertSentCount(1);
});

it('limite la santé à 6 requêtes par minute', function (): void {
    for ($i = 0; $i < 6; $i++) {
        C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertOk();
    }

    C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertStatus(429);
});

it('mesure le retard de la file d\'attente avec le pilote database', function (): void {
    config(['queue.default' => 'database', 'queue.connections.database.driver' => 'database', 'operations.queue_max_age_seconds' => 900]);

    $etat = function (): array {
        Cache::flush();

        return C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->json('data.components.queue');
    };

    expect($etat()['state'])->toBe('ok');

    DB::table('jobs')->insert(['queue' => 'default', 'payload' => '{}', 'attempts' => 0, 'available_at' => now()->getTimestamp(), 'created_at' => now()->subMinutes(30)->getTimestamp()]);
    $retard = $etat();

    expect($retard['state'])->toBe('down')
        ->and($retard['queues'][0])->toMatchArray(['queue' => 'default', 'pending' => 1]);

    DB::table('jobs')->truncate();
    DB::table('jobs')->insert(['queue' => 'default', 'payload' => '{}', 'attempts' => 0, 'available_at' => now()->getTimestamp(), 'created_at' => now()->getTimestamp()]);

    expect($etat()['state'])->toBe('ok');
});

it('annonce unknown pour la file avec un pilote qui ne permet pas de mesurer', function (): void {
    config(['queue.default' => 'sync']);
    Cache::flush();

    C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertJsonPath('data.components.queue.state', 'unknown');
});

it('enregistre les tâches planifiées par les événements du planificateur', function (): void {
    $tache = ($this->tache)();

    expect(C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->json('data.components.scheduler.state'))->toBe('unknown');

    event(new ScheduledTaskStarting($tache));
    $ligne = ScheduledTaskRun::query()->firstOrFail();

    expect($ligne->command)->toBe('privacy:flag-due')
        ->and($ligne->expression)->toBe('0 7 * * *')
        ->and($ligne->last_status->value)->toBe('running');

    event(new ScheduledTaskFinished($tache, 1.5));
    Cache::flush();
    $reponse = C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertOk();

    expect($reponse->json('data.components.scheduler.state'))->toBe('ok')
        ->and($reponse->json('data.components.scheduler.tasks.0'))->toMatchArray(['command' => 'privacy:flag-due', 'status' => 'succeeded', 'duration_ms' => 1500, 'late' => false]);
});

it('signale un échec de tâche planifiée sans conserver le message d\'erreur', function (): void {
    $tache = ($this->tache)();
    event(new ScheduledTaskStarting($tache));
    event(new ScheduledTaskFailed($tache, new RuntimeException('secret-interne-12345')));

    $ligne = ScheduledTaskRun::query()->firstOrFail();
    Cache::flush();
    $corps = C::lire($this, $this->admin['jeton'], '/api/v1/console/health');

    expect($ligne->last_status->value)->toBe('failed')
        ->and($ligne->last_error_class)->toBe(RuntimeException::class)
        ->and($corps->json('data.components.scheduler.state'))->toBe('down')
        ->and($corps->getContent())->not->toContain('secret-interne-12345');
});

it('signale une tâche planifiée en retard sur sa fréquence déclarée', function (): void {
    $tache = ($this->tache)('privacy:purge-exports', '0 3 * * *');
    event(new ScheduledTaskStarting($tache));
    event(new ScheduledTaskFinished($tache, 0.2));

    ScheduledTaskRun::query()->update(['last_started_at' => now()->subDays(3)->format('Y-m-d H:i:s.u')]);
    Cache::flush();

    $reponse = C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertOk();

    expect($reponse->json('data.components.scheduler.state'))->toBe('down')
        ->and($reponse->json('data.components.scheduler.tasks.0.late'))->toBeTrue();
});

it('sonde les sauvegardes : unknown sans preuve, ok si récente, down au-delà de 26 heures', function (): void {
    $etat = function (): array {
        Cache::flush();

        return C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->json('data.components.backups');
    };

    expect($etat()['state'])->toBe('unknown');

    ($this->sauvegarde)('database');
    ($this->sauvegarde)('documents');
    expect($etat()['state'])->toBe('ok');

    BackupReport::query()->where('kind', 'database')->delete();
    ($this->sauvegarde)('database', now()->subHours(27));
    $perimee = $etat();

    expect($perimee['state'])->toBe('down')
        ->and($perimee['max_age_hours'])->toBe(26);
});

it('ignore une sauvegarde échouée dans la sonde', function (): void {
    ($this->sauvegarde)('database', now()->subHours(1), false);
    ($this->sauvegarde)('documents');
    Cache::flush();

    expect(C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->json('data.components.backups.state'))->toBe('unknown');
});

it('une sonde en erreur donne unknown sans casser la réponse', function (): void {
    Schema::drop('scheduled_task_runs');
    Cache::flush();

    $reponse = C::lire($this, $this->admin['jeton'], '/api/v1/console/health')->assertOk();

    expect($reponse->json('data.components.scheduler.state'))->toBe('unknown')
        ->and($reponse->json('data.components.database.state'))->toBe('ok');
});

it('liste les preuves de sauvegarde avec filtres et pagination', function (): void {
    ($this->sauvegarde)('database', now()->subHours(5));
    ($this->sauvegarde)('documents', now()->subHours(4));
    ($this->sauvegarde)('database', now()->subHours(3), false);
    BackupReport::query()->create([
        'kind' => 'restore_test', 'started_at' => now()->subHours(1), 'duration_seconds' => 30, 'succeeded' => true,
        'restore_test_target' => 'staging-restore', 'restore_test_result' => 'passed',
    ]);

    $liste = C::lire($this, $this->ingenierie['jeton'], '/api/v1/console/backups')->assertOk();

    expect($liste->json('data'))->toHaveCount(4)
        ->and(array_keys($liste->json('data.0')))->toEqualCanonicalizing(['id', 'kind', 'started_at', 'duration_seconds', 'size_bytes', 'succeeded', 'manifest_sha256', 'restore_test', 'recorded_at'])
        ->and($liste->json('meta'))->toHaveKeys(['has_more', 'next_cursor', 'max_age_hours', 'last_success_at'])
        ->and($liste->json('meta.max_age_hours'))->toBe(26)
        ->and($liste->json('meta.last_success_at'))->toHaveKeys(['database', 'documents'])
        ->and(collect($liste->json('data'))->firstWhere('kind', 'restore_test')['restore_test'])->toBe(['target' => 'staging-restore', 'result' => 'passed']);

    C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?kind=database')->assertJsonCount(2, 'data');
    C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?succeeded=0')->assertJsonCount(1, 'data');
    C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?succeeded=1')->assertJsonCount(3, 'data');

    $page1 = C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?per_page=3')->assertOk();
    expect($page1->json('meta.has_more'))->toBeTrue();
    $page2 = C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?per_page=3&cursor='.$page1->json('meta.next_cursor'))->assertOk();

    expect($page2->json('data'))->toHaveCount(1)
        ->and($page2->json('meta.has_more'))->toBeFalse();
});

it('valide les filtres de la liste des sauvegardes', function (): void {
    C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?kind=autre')->assertUnprocessable();
    C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?succeeded=peut-etre')->assertUnprocessable();
    C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?cursor=pas-un-curseur')->assertUnprocessable();
    C::lire($this, $this->admin['jeton'], '/api/v1/console/backups?per_page=1000')->assertUnprocessable();
});

it('rend les réglages effectifs sans aucun secret', function (): void {
    config(['identity.console_relay_key' => 'cle-secrete-de-relais', 'payments.providers.stripe.secret_key' => 'sk_live_secret']);

    $reponse = C::lire($this, $this->support['jeton'], '/api/v1/console/settings')->assertOk();

    expect(array_keys($reponse->json('data')))->toBe(['console', 'sessions', 'support', 'broadcasts', 'antivirus', 'mail', 'payments', 'approvals', 'privacy', 'backups'])
        ->and($reponse->json('data.console.token_ttl_minutes'))->toBe(240)
        ->and($reponse->json('data.approvals.ttl_hours'))->toBe(24)
        ->and($reponse->json('data.backups.max_age_hours'))->toBe(26)
        ->and($reponse->json('data.payments.gateway'))->toBeIn(['none', 'fake', 'provider'])
        ->and($reponse->getContent())->not->toContain('cle-secrete-de-relais')
        ->and($reponse->getContent())->not->toContain('sk_live_secret');
});

it('masque la passerelle de paiement réelle derrière « provider »', function (): void {
    config(['payments.gateway' => 'stripe']);

    C::lire($this, $this->admin['jeton'], '/api/v1/console/settings')->assertJsonPath('data.payments.gateway', 'provider');
});

it('enregistre une preuve de sauvegarde par commande et la journalise', function (): void {
    $this->artisan('operations:record-backup', [
        'kind' => 'database', '--started' => now()->subHour()->toIso8601String(), '--duration' => '95', '--size' => '123456', '--manifest' => str_repeat('b', 64),
    ])->assertSuccessful();

    $rapport = BackupReport::query()->firstOrFail();

    expect($rapport->kind->value)->toBe('database')
        ->and($rapport->duration_seconds)->toBe(95)
        ->and($rapport->size_bytes)->toBe(123456)
        ->and($rapport->succeeded)->toBeTrue()
        ->and(AuditLog::query()->where('action', 'operations.backup.recorded')->count())->toBe(1);

    $this->artisan('operations:record-backup', [
        'kind' => 'restore_test', '--started' => now()->subHour()->toIso8601String(), '--duration' => '600', '--target' => 'staging-restore', '--result' => 'passed',
    ])->assertSuccessful();

    expect(BackupReport::query()->where('kind', 'restore_test')->firstOrFail()->restore_test_result?->value)->toBe('passed');
});

it('refuse les preuves de sauvegarde invalides', function (array $arguments): void {
    $this->artisan('operations:record-backup', $arguments)->assertFailed();

    expect(BackupReport::query()->count())->toBe(0);
})->with([
    'type inconnu' => [['kind' => 'autre', '--started' => '2026-01-01T00:00:00Z', '--duration' => '1']],
    'durée absente' => [['kind' => 'database', '--started' => '2026-01-01T00:00:00Z']],
    'date absente' => [['kind' => 'database', '--duration' => '1']],
    'date future' => [['kind' => 'database', '--started' => '2099-01-01T00:00:00Z', '--duration' => '1']],
    'empreinte invalide' => [['kind' => 'database', '--started' => '2026-01-01T00:00:00Z', '--duration' => '1', '--manifest' => 'xyz']],
    'test de restauration sans cible' => [['kind' => 'restore_test', '--started' => '2026-01-01T00:00:00Z', '--duration' => '1']],
    'cible sur une sauvegarde' => [['kind' => 'database', '--started' => '2026-01-01T00:00:00Z', '--duration' => '1', '--target' => 'x', '--result' => 'passed']],
    'cible avec caractères interdits' => [['kind' => 'restore_test', '--started' => '2026-01-01T00:00:00Z', '--duration' => '1', '--target' => 'a b;rm', '--result' => 'passed']],
]);

it('interdit toute modification d\'une preuve de sauvegarde', function (): void {
    $rapport = ($this->sauvegarde)();

    expect(fn () => DB::table('backup_reports')->where('id', $rapport->id)->update(['succeeded' => false]))->toThrow(QueryException::class);
});

it('n\'expose aucune route HTTP d\'écriture pour les sauvegardes', function (): void {
    C::ecrire($this, $this->admin['jeton'], 'POST', '/api/v1/console/backups', ['kind' => 'database'])->assertStatus(405);
    C::ecrire($this, $this->admin['jeton'], 'DELETE', '/api/v1/console/backups')->assertStatus(405);
    C::ecrire($this, $this->admin['jeton'], 'PUT', '/api/v1/console/settings', ['x' => 1])->assertStatus(405);
});
