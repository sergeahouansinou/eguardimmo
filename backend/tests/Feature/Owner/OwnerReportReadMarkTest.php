<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Reporting\Models\ManagementReport;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Route;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\Reporting\ReportingContext as RP;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = RP::agence($this);
    $this->awa = X::rattacher($this->org, $this->mandant);
    RP::parcours($this);
    X::agence($this, $this->org);
    $this->id = RP::rapport($this);
    RP::publier($this, $this->id)->assertOk();
    $this->marquer = fn (?User $compte, ?string $id = null) => O::comme($this, $compte)->postJson('/api/v1/owner/management-reports/'.($id ?? $this->id).'/read');
    $this->lecture = fn () => ManagementReport::query()->withoutGlobalScopes()->findOrFail($this->id)->first_read_at;
});

it('marque le compte rendu lu : première lecture posée, audit unique, sans 2FA', function (): void {
    expect(($this->lecture)())->toBeNull();

    $reponse = ($this->marquer)($this->awa)->assertOk()->assertHeader('Cache-Control', 'no-store, private');

    expect($reponse->json('data.id'))->toBe($this->id)->and($reponse->json('data.first_read_at'))->not->toBeNull()->and(($this->lecture)())->not->toBeNull()
        ->and(AuditLog::query()->where('action', 'reporting.report.read')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'reporting.report.read')->sole()->actor_user_id)->toBe($this->awa->id)
        ->and(R::lire($this, $this->awa, '/management-reports')->json('data.0.first_read_at'))->toBe($reponse->json('data.first_read_at'));
});

it('est idempotent : le rejeu répond 200, ne déplace pas la première lecture et ne journalise rien', function (): void {
    ($this->marquer)($this->awa)->assertOk();
    $premiere = ($this->lecture)()->format('Y-m-d H:i:s.u');
    $this->travelTo(now()->addDays(3));

    ($this->marquer)($this->awa)->assertOk()->assertJsonPath('data.first_read_at', ($this->lecture)()->toIso8601String());

    expect(($this->lecture)()->format('Y-m-d H:i:s.u'))->toBe($premiere)->and(AuditLog::query()->where('action', 'reporting.report.read')->count())->toBe(1);
});

it('un second compte du même mandant ne remplace pas la première lecture', function (): void {
    $rep = User::factory()->create(['email' => 'rep@exemple.fr']);
    O::acces($this->org, $this->mandant, $rep, OwnerAccessRole::Representative);
    ($this->marquer)($this->awa)->assertOk();
    $premiere = ($this->lecture)();
    $this->travelTo(now()->addHour());

    ($this->marquer)($rep)->assertOk();

    expect(($this->lecture)()->equalTo($premiere))->toBeTrue()->and(AuditLog::query()->where('action', 'reporting.report.read')->count())->toBe(1);
});

it('401 sans session, 403 sans profil propriétaire', function (): void {
    ($this->marquer)(null)->assertUnauthorized();

    foreach ([User::factory()->create(), T::locataire($this->org)['user'], L::titulaire($this->org)] as $compte) {
        ($this->marquer)($compte)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    }

    expect(($this->lecture)())->toBeNull();
});

it('403 pour un co-indivisaire et pendant la grâce, sans rien écrire', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    O::acces($this->org, $this->mandant, $co, OwnerAccessRole::CoOwner);

    ($this->marquer)($co)->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');

    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'terminated', 'ends_on' => now()->subMonth()->toDateString()]));
    ($this->marquer)($this->awa)->assertForbidden()->assertJsonPath('code', 'owner_access_read_only');

    expect(($this->lecture)())->toBeNull();
});

it('404 sur le compte rendu d\'un autre mandant, d\'une autre organisation, non publié ou inconnu', function (): void {
    $autreMandant = O::mandant($this->org, 'bob@exemple.fr');
    O::mandat($this->org, $autreMandant);
    $bob = X::rattacher($this->org, $autreMandant, 'bob@exemple.fr');
    $ailleurs = L::organisation();
    $ailleursMandant = O::mandant($ailleurs, 'clone@exemple.fr');
    O::mandat($ailleurs, $ailleursMandant);
    $clone = X::rattacher($ailleurs, $ailleursMandant, 'clone@exemple.fr');

    foreach ([$bob, $clone] as $intrus) {
        ($this->marquer)($intrus)->assertNotFound()->assertJsonPath('code', 'owner_report_not_found');
    }

    X::agence($this, $this->org);
    $genere = RP::rapport($this, ['period_start' => '2026-10-01', 'period_end' => '2026-10-31']);
    ($this->marquer)($this->awa, $genere)->assertNotFound()->assertJsonPath('code', 'owner_report_not_found');
    ($this->marquer)($this->awa, fake()->uuid())->assertNotFound()->assertJsonPath('code', 'owner_report_not_found');
    ($this->marquer)($this->awa, 'pas-un-uuid')->assertNotFound();

    expect(($this->lecture)())->toBeNull();
});

it('coupe le marquage au-delà de 60 requêtes par minute', function (): void {
    $statuts = [];

    foreach (range(1, 62) as $i) {
        $statuts[] = ($this->marquer)($this->awa)->status();
    }

    expect($statuts[61])->toBe(429);
});

it('protège la route : middlewares, nom et limite dédiée', function (): void {
    $route = Route::getRoutes()->getByName('reporting.owner.reports.read');

    expect($route->gatherMiddleware())->toContain('auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:60,1,owner-report-read')->and($route->methods())->toBe(['POST']);
});
