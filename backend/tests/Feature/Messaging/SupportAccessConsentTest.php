<?php

declare(strict_types=1);

use App\Modules\Messaging\Events\SupportAccessRequested;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\SupportAccessContext as A;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(A::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->op = A::operateur();
    O::navigateurAgence($this);
    $this->ticket = A::demande($this, $this->titulaire, $this->org);
    $this->demander = fn (array $corps = []) => A::demanderAcces($this, $this->op['jeton'], $this->ticket, $corps);
    $this->decider = function (string $id, string $action, array $corps = [], $compte = null) {
        O::preuve($this);

        return A::organisation($this, $this->org, $compte ?? $this->titulaire, "/{$id}/{$action}", 'POST', $corps);
    };
});

it('mène une demande d\'accès de la console jusqu\'au consentement de l\'organisation', function (): void {
    Event::fake([SupportAccessRequested::class]);
    $demande = ($this->demander)()->assertCreated()
        ->assertJsonPath('data.status', 'requested')->assertJsonPath('data.kind', 'consent')
        ->assertJsonPath('data.scopes', ['settings', 'team'])->assertJsonPath('data.duration_hours', 24)
        ->assertJsonPath('data.organization_id', $this->org->id);
    $id = $demande->json('data.id');
    Event::assertDispatched(SupportAccessRequested::class, fn (SupportAccessRequested $e): bool => $e->organizationId === $this->org->id && $e->grantId === $id);

    $liste = A::organisation($this, $this->org, $this->titulaire)->assertOk()->assertJsonPath('data.0.status', 'requested')->assertJsonPath('data.0.operator', 'Julie M.');
    expect($liste->getContent())->not->toContain($this->op['user']->id)->not->toContain('Julie Martin');

    ($this->decider)($id, 'accept')->assertOk()->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.expires_at', now()->addHours(24)->toIso8601String());

    expect(AuditLog::query()->whereIn('action', ['messaging.support_access.requested', 'messaging.support_access.granted'])->count())->toBe(2);
});

it('refuse la demande, et on ne peut plus ni l\'accepter ni la refuser', function (): void {
    $id = ($this->demander)()->assertCreated()->json('data.id');

    ($this->decider)($id, 'refuse')->assertOk()->assertJsonPath('data.status', 'refused');
    ($this->decider)($id, 'accept')->assertConflict()->assertJsonPath('code', 'support_access_not_pending');
    ($this->decider)($id, 'refuse')->assertConflict()->assertJsonPath('code', 'support_access_not_pending');

    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertForbidden()->assertJsonPath('code', 'support_access_required');
    expect(AuditLog::query()->where('action', 'messaging.support_access.refused')->count())->toBe(1);
});

it('exige la preuve 2FA récente pour accepter, mais pas pour refuser', function (): void {
    $id = ($this->demander)()->assertCreated()->json('data.id');

    O::comme($this, $this->titulaire);
    $this->flushSession();
    $this->postJson("/api/v1/org/{$this->org->id}/support-access/{$id}/accept")->assertStatus(403);
    expect(A::grant($id)->status->value)->toBe('requested');

    ($this->decider)($id, 'refuse')->assertOk();
});

it('réserve la décision aux owner et admin de l\'organisation', function (): void {
    $id = ($this->demander)()->assertCreated()->json('data.id');
    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    $comptable = L::membre($this->org, MemberRole::Accountant);

    foreach ([$gestionnaire, $comptable] as $compte) {
        foreach (['accept', 'refuse', 'revoke'] as $action) {
            ($this->decider)($id, $action, [], $compte)->assertForbidden();
        }
        A::organisation($this, $this->org, $compte)->assertForbidden();
    }
    expect(A::grant($id)->status->value)->toBe('requested');

    $admin = L::membre($this->org, MemberRole::Admin);
    activerDeuxFacteurs($admin);
    ($this->decider)($id, 'accept', [], $admin)->assertOk();
});

it('refuse une durée au-delà de 72 h à la demande, et à l\'acceptation une durée ou un périmètre plus larges que demandés', function (): void {
    ($this->demander)(['duration_hours' => 73])->assertUnprocessable()->assertJsonPath('code', 'support_access_duration_invalid');
    ($this->demander)(['duration_hours' => 0])->assertUnprocessable();
    ($this->demander)(['scopes' => ['conversations']])->assertUnprocessable()->assertJsonValidationErrors('scopes.0');
    ($this->demander)(['scopes' => []])->assertUnprocessable();
    ($this->demander)(['reason' => 'court'])->assertUnprocessable()->assertJsonValidationErrors('reason');

    $id = ($this->demander)(['scopes' => ['settings'], 'duration_hours' => 48])->assertCreated()->json('data.id');
    ($this->decider)($id, 'accept', ['duration_hours' => 72])->assertUnprocessable()->assertJsonPath('code', 'support_access_duration_invalid');
    ($this->decider)($id, 'accept', ['scopes' => ['settings', 'records']])->assertUnprocessable()->assertJsonPath('code', 'support_access_scope_invalid');
    expect(A::grant($id)->status->value)->toBe('requested');

    ($this->decider)($id, 'accept', ['duration_hours' => 2])->assertOk()->assertJsonPath('data.duration_hours', 2)
        ->assertJsonPath('data.expires_at', now()->addHours(2)->toIso8601String());
});

it('applique 24 h par défaut et accepte 72 h au plus, puis l\'accès cesse à l\'échéance', function (): void {
    $id = ($this->demander)(['scopes' => ['team'], 'duration_hours' => 72])->assertCreated()->json('data.id');
    ($this->decider)($id, 'accept')->assertOk()->assertJsonPath('data.expires_at', now()->addHours(72)->toIso8601String());

    $this->travelTo(now()->addHours(71));
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertOk();

    $this->travelTo(now()->addHours(1)->addMinute());
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertForbidden()->assertJsonPath('code', 'support_access_required');

    $this->artisan('messaging:expire-support-access')->assertSuccessful();
    expect(A::grant($id)->status->value)->toBe('expired')
        ->and(AuditLog::query()->where('action', 'messaging.support_access.expired')->count())->toBe(1);
});

it('applique 24 h quand la demande ne précise pas de durée', function (): void {
    $id = ($this->demander)(['duration_hours' => null])->assertCreated()->assertJsonPath('data.duration_hours', 24)->json('data.id');
    ($this->decider)($id, 'accept')->assertOk()->assertJsonPath('data.expires_at', now()->addHours(24)->toIso8601String());
});

it('périme une demande jamais traitée après 7 jours', function (): void {
    $id = ($this->demander)()->assertCreated()->json('data.id');

    $this->travelTo(now()->addDays(8));
    $this->artisan('messaging:expire-support-access')->assertSuccessful();

    expect(A::grant($id)->status->value)->toBe('expired');
    ($this->decider)($id, 'accept')->assertConflict();
});

it('révoque aussitôt un accès actif, de façon rejouable, et ne révoque ni une demande ni un accès refusé', function (): void {
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertOk();

    ($this->decider)($id, 'revoke')->assertOk()->assertJsonPath('data.status', 'revoked');
    ($this->decider)($id, 'revoke')->assertOk()->assertJsonPath('data.status', 'revoked');
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertForbidden();
    expect(AuditLog::query()->where('action', 'messaging.support_access.revoked')->count())->toBe(1);

    $autre = ($this->demander)()->assertCreated()->json('data.id');
    ($this->decider)($autre, 'revoke')->assertConflict()->assertJsonPath('code', 'support_access_not_pending');
});

it('met fin à l\'accès quand la demande de support est résolue', function (): void {
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);

    A::jeton($this);
    $this->withToken($this->op['jeton'])->patchJson("/api/v1/console/support/tickets/{$this->ticket}", avecPreuve($this->op['jeton'], ['status' => 'resolved']))->assertOk();

    expect(A::grant($id)->status->value)->toBe('expired');
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertForbidden();
});

it('refuse une seconde demande tant qu\'une demande ou un accès est ouvert', function (): void {
    ($this->demander)()->assertCreated();
    ($this->demander)()->assertConflict()->assertJsonPath('code', 'support_access_already_open');
});

it('refuse une demande d\'accès sur une demande de support sans organisation ou résolue', function (): void {
    $compte = T::locataire($this->org)['user'];
    $hors = A::demande($this, $compte, null);
    A::demanderAcces($this, $this->op['jeton'], $hors)->assertUnprocessable()->assertJsonPath('code', 'support_access_organization_required');

    A::jeton($this);
    $this->withToken($this->op['jeton'])->patchJson("/api/v1/console/support/tickets/{$this->ticket}", avecPreuve($this->op['jeton'], ['status' => 'resolved']))->assertOk();
    ($this->demander)()->assertConflict()->assertJsonPath('code', 'ticket_resolved');
});

it('cloisonne les accès par organisation : une autre agence ne voit ni ne décide rien', function (): void {
    $id = ($this->demander)()->assertCreated()->json('data.id');
    $autre = T::organisation('Agence Rivale');
    $titulaireAutre = L::titulaire($autre);

    A::organisation($this, $autre, $titulaireAutre)->assertOk()->assertJsonCount(0, 'data');
    foreach (['accept', 'refuse', 'revoke'] as $action) {
        O::preuve($this);
        A::organisation($this, $autre, $titulaireAutre, "/{$id}/{$action}", 'POST')->assertNotFound()->assertJsonPath('code', 'support_access_not_found');
    }

    O::preuve($this);
    A::organisation($this, $this->org, $titulaireAutre, "/{$id}/accept", 'POST')->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    expect(A::grant($id)->status->value)->toBe('requested');
});

it('réserve la demande d\'accès à la console, avec un jeton opérateur', function (): void {
    $url = "/api/v1/console/support/tickets/{$this->ticket}/access-requests";
    $corps = ['reason' => 'Vérifier le paramétrage', 'scopes' => ['team']];

    A::jeton($this);
    $this->postJson($url, $corps)->assertUnauthorized();
    auth()->forgetGuards();
    $this->actingAs($this->titulaire)->postJson($url, $corps)->assertForbidden();

    A::jeton($this);
    $this->withToken($this->op['jeton'])->getJson("/api/v1/org/{$this->org->id}/support-access")->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});

it('liste les accès de l\'organisation par curseur, sans requête par ligne', function (): void {
    foreach (range(1, 3) as $i) {
        $id = ($this->demander)(['reason' => "Vérification numéro {$i} du paramétrage"])->assertCreated()->json('data.id');
        ($this->decider)($id, 'refuse')->assertOk();
    }

    $page = A::organisation($this, $this->org, $this->titulaire, '?per_page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.has_more', true);
    $suite = A::organisation($this, $this->org, $this->titulaire, '?per_page=2&cursor='.urlencode($page->json('meta.next_cursor')))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.has_more', false);
    expect(array_intersect(array_column($page->json('data'), 'id'), array_column($suite->json('data'), 'id')))->toBe([]);

    A::organisation($this, $this->org, $this->titulaire, '?status=refused')->assertOk()->assertJsonCount(3, 'data');
    A::organisation($this, $this->org, $this->titulaire, '?status=active')->assertOk()->assertJsonCount(0, 'data');

    O::comme($this, $this->titulaire);
    DB::enableQueryLog();
    $this->getJson("/api/v1/org/{$this->org->id}/support-access?per_page=3")->assertOk();
    $avec3 = count(DB::getQueryLog());
    DB::flushQueryLog();
    $this->getJson("/api/v1/org/{$this->org->id}/support-access?per_page=1")->assertOk();
    expect($avec3)->toBe(count(DB::getQueryLog()));
});
