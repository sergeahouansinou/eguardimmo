<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

const AUTEUR = '01934f6e-0000-7000-8000-0000000000aa';

it('enregistre une entrée d\'audit avec IP et user-agent tronqué', function (): void {
    $this->withHeader('User-Agent', str_repeat('a', 400))->get('/up');

    app(RecordAudit::class)->handle('test.action', AUTEUR, ['cle' => 'valeur']);

    $entree = AuditLog::query()->where('action', 'test.action')->sole();

    expect($entree->actor_user_id)->toBe(AUTEUR)
        ->and($entree->metadata)->toBe(['cle' => 'valeur'])
        ->and($entree->changes)->toBeNull()
        ->and($entree->id)->toBeUuid()
        ->and(strlen((string) $entree->user_agent))->toBeLessThanOrEqual(255);
});

it('rattache l\'auteur authentifié, la route, l\'identifiant de requête et le sujet', function (): void {
    $user = User::factory()->create();
    Route::middleware('api')->post('/api/v1/sonde-audit', function (RecordAudit $audit) use ($user): array {
        $audit->handle('sonde.faite', subject: $user, metadata: ['n' => 1]);

        return [];
    })->name('sonde.audit');

    $reponse = $this->actingAs($user, 'sanctum')->postJson('/api/v1/sonde-audit')->assertOk();

    $entree = AuditLog::query()->where('action', 'sonde.faite')->sole();
    expect($entree->actor_user_id)->toBe($user->id)
        ->and($entree->subject_type)->toBe('user')
        ->and($entree->subject_id)->toBe($user->id)
        ->and($entree->route)->toBe('sonde.audit')
        ->and($entree->request_id)->toBe($reponse->headers->get('X-Request-Id'))
        ->and($entree->subject?->is($user))->toBeTrue();
});

it('prend l\'organisation courante quand le sujet n\'en porte pas', function (): void {
    $organisation = '01934f6e-0000-7000-8000-0000000000bb';

    app(CurrentOrganization::class)->run($organisation, fn (): AuditLog => app(RecordAudit::class)->handle('test.action'));

    expect(AuditLog::query()->sole()->organization_id)->toBe($organisation);
});

it('interdit la modification d\'une entrée', function (): void {
    app(RecordAudit::class)->handle('test.action');
    $entree = AuditLog::query()->sole();
    $entree->action = 'falsifie';

    expect(fn () => $entree->save())->toThrow(LogicException::class);
});

it('interdit la suppression d\'une entrée', function (): void {
    app(RecordAudit::class)->handle('test.action');

    expect(fn () => AuditLog::query()->sole()->delete())->toThrow(LogicException::class);
});

it('interdit les modifications et suppressions en masse', function (): void {
    app(RecordAudit::class)->handle('test.action');

    expect(fn () => AuditLog::query()->update(['action' => 'x']))->toThrow(LogicException::class)
        ->and(fn () => AuditLog::query()->delete())->toThrow(LogicException::class)
        ->and(AuditLog::query()->where('action', 'test.action')->count())->toBe(1);
});

it('filtre par préfixe d\'action sans traiter _ comme joker', function (): void {
    app(RecordAudit::class)->handle('auth_x.login');
    app(RecordAudit::class)->handle('authyx.login');

    expect(AuditLog::query()->actionStartingWith('auth_x.')->pluck('action')->all())->toBe(['auth_x.login']);
});

it('journalise un e-mail par HMAC à clé dédiée, jamais en SHA-256 nu', function (): void {
    $empreinte = app(RecordAudit::class)->fingerprint(' Jean@Exemple.fr ');

    expect($empreinte)->toBe(hash_hmac('sha256', 'jean@exemple.fr', 'cle-hmac-de-test'))
        ->and($empreinte)->not->toBe(hash('sha256', 'jean@exemple.fr'));
});

it('refuse de journaliser un e-mail sans clé HMAC', function (): void {
    config(['audit.hmac_key' => '']);

    expect(fn () => app(RecordAudit::class)->fingerprint('jean@exemple.fr'))->toThrow(RuntimeException::class);
});

it('assainit un user-agent et des métadonnées en UTF-8 invalide sans perdre l\'entrée', function (): void {
    $this->withHeader('User-Agent', "Mozilla\xff\xfe\xc3(\x07\x1b[31m")->get('/up');

    app(RecordAudit::class)->handle('test.action', metadata: ['nom' => "abc\xff"], changes: ['titre' => ['old' => "x\xfe", 'new' => 'y']]);

    $entree = AuditLog::query()->sole();
    expect(mb_check_encoding((string) $entree->user_agent, 'UTF-8'))->toBeTrue()
        ->and($entree->user_agent)->not->toMatch('/[\x00-\x1F\x7F]/')
        ->and($entree->user_agent)->toStartWith('Mozilla')
        ->and(mb_check_encoding((string) json_encode($entree->metadata), 'UTF-8'))->toBeTrue()
        ->and($entree->changes['titre']['new'] ?? null)->toBe('y');
});

it('conserve les microsecondes de l\'horodatage', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-11-14 10:00:00.123456'));

    app(RecordAudit::class)->handle('test.action');

    expect(AuditLog::query()->sole()->occurred_at->format('u'))->toBe('123456');
});

it('refuse en base toute modification, suppression ou vidage hors de l\'application', function (): void {
    app(RecordAudit::class)->handle('test.action');

    expect(fn () => DB::table('audit_logs')->update(['action' => 'x']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('audit_logs')->delete())->toThrow(QueryException::class)
        ->and(fn () => AuditLog::query()->toBase()->update(['action' => 'x']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('audit_logs')->increment('action'))->toThrow(QueryException::class)
        ->and(fn () => DB::table('audit_logs')->truncate())->toThrow(QueryException::class)
        ->and(DB::table('audit_logs')->where('action', 'test.action')->count())->toBe(1);
});
