<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Events\ApprovalDecided;
use App\Modules\Maintenance\Events\ApprovalExpired;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Notification;
use App\Modules\OwnerFunds\Events\PayoutExecuted;
use App\Modules\OwnerFunds\Events\PayoutReturned;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Reporting\Events\ManagementReportPublished;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerWriteContext as W;

beforeEach(function (): void {
    ['scene' => $this->scene, 'awa' => $this->awa] = W::agence($this);
    $this->org = $this->scene['org'];
    $this->mandant = $this->scene['mandant'];
    $this->liste = fn (User $compte): array => O::comme($this, $compte)->getJson('/api/v1/notifications')->assertOk()->json('data');
});

it('prévient le mandant d\'une demande d\'accord, dans le centre et par e-mail, sans montant ni nom', function (): void {
    [$id, , $demande] = W::demande($this, $this->scene);

    $n = N::premiere($this->awa, NotificationType::OwnerApprovalRequested);

    expect($n->audience->value)->toBe('owner')->and($n->party_id)->toBe($this->mandant->id)->and($n->organization_id)->toBe($this->org->id)
        ->and($n->in_app)->toBeTrue()->and($n->email)->toBeTrue()->and($n->push)->toBeFalse()->and($n->link)->toBe("/interventions/{$id}")
        ->and($n->dedup_key)->toBe("approval:{$demande}:requested")
        ->and($n->title.' '.$n->body)->not->toContain('600')->not->toContain('720')->not->toContain($this->mandant->display_name)
        ->and(collect(($this->liste)($this->awa))->pluck('type')->all())->toContain('owner.approval_requested');
});

it('ne notifie ni un co-indivisaire, ni le mandant d\'un autre, ni l\'équipe', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    O::acces($this->org, $this->mandant, $co, OwnerAccessRole::CoOwner);
    $autre = O::mandant($this->org, 'bob@exemple.fr');
    O::mandat($this->org, $autre);
    $bob = User::factory()->create(['email' => 'bob@exemple.fr']);
    O::acces($this->org, $autre, $bob);

    W::demande($this, $this->scene);

    expect(N::nombre($co))->toBe(0)->and(N::nombre($bob))->toBe(0)->and(N::nombre(L::titulaire($this->org), NotificationType::OwnerApprovalRequested))->toBe(0)
        ->and(($this->liste)($co))->toBe([])->and(($this->liste)($bob))->toBe([]);
});

it('la lecture suit la clé : accès révoqué ou fenêtre échue, la notification disparaît sans être effacée', function (): void {
    W::demande($this, $this->scene);
    expect(($this->liste)($this->awa))->toHaveCount(1);

    $fin = L::dans($this->org, fn () => Mandate::query()->value('ends_on'));
    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'terminated', 'ends_on' => now()->subMonths(13)->toDateString()]));
    expect(($this->liste)($this->awa))->toBe([])->and(N::nombre($this->awa))->toBe(1);

    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'active', 'ends_on' => $fin]));
    expect(($this->liste)($this->awa))->toHaveCount(1);

    L::dans($this->org, fn () => OwnerAccess::query()->update(['status' => 'revoked', 'revoked_at' => now()]));
    expect(($this->liste)($this->awa))->toBe([])->and(O::comme($this, $this->awa)->getJson('/api/v1/notifications/unread-count')->json('data.unread'))->toBe(0);
});

it('un autre compte ne marque pas la notification du mandant comme lue', function (): void {
    W::demande($this, $this->scene);
    $n = N::premiere($this->awa, NotificationType::OwnerApprovalRequested);
    $bob = User::factory()->create(['email' => 'bob@exemple.fr']);

    O::comme($this, $bob)->postJson("/api/v1/notifications/{$n->id}/read")->assertNotFound();
    O::comme($this, $this->awa)->postJson("/api/v1/notifications/{$n->id}/read")->assertOk();

    expect(Notification::query()->find($n->id)->read_at)->not->toBeNull();
});

it('expose les types owner au compte propriétaire seulement, la demande d\'accord reste dans le centre', function (): void {
    $types = fn (User $c) => O::comme($this, $c)->getJson('/api/v1/notifications/preferences')->assertOk()->json('data.types');
    $codes = collect($types($this->awa))->pluck('type');

    expect($codes->filter(fn ($t) => str_starts_with($t, 'owner.'))->values()->all())->toBe([
        'owner.approval_requested', 'owner.approval_expired', 'owner.approval_recorded', 'owner.report_published', 'owner.tax_statement_published', 'owner.payout_executed', 'owner.payout_returned',
        'owner.account_change_requested', 'owner.account_change_approved', 'owner.account_change_contested', 'owner.document_shared', 'owner.mandate_end_dismissed', 'owner.mandate_end_fulfilled', 'owner.message_received', 'owner.message_redacted', 'owner.announcement',
    ])->and(collect($types(L::titulaire($this->org)))->pluck('type')->filter(fn ($t) => str_starts_with($t, 'owner.')))->toBeEmpty();

    $verrou = collect(collect($types($this->awa))->firstWhere('type', 'owner.approval_requested')['channels'])->keyBy('channel');
    expect($verrou['in_app']['locked'])->toBeTrue()->and($verrou['email']['locked'])->toBeFalse();
});

it('le centre et l\'e-mail des alertes de compte de paiement ne se désactivent pas ; le reste oui', function (): void {
    $changer = fn (string $type, string $canal) => O::comme($this, $this->awa)->putJson('/api/v1/notifications/preferences', ['preferences' => [['type' => $type, 'channel' => $canal, 'enabled' => false]]]);

    $changer('owner.account_change_requested', 'email')->assertStatus(422);
    $changer('owner.account_change_approved', 'in_app')->assertStatus(422);
    $changer('owner.account_change_contested', 'email')->assertStatus(422);
    $changer('owner.approval_requested', 'in_app')->assertStatus(422);
    $changer('owner.report_published', 'email')->assertOk();

    expect(NotificationType::OwnerReportPublished->locked())->toBe([]);
});

it('les événements de reversement, d\'accord expiré ou enregistré par l\'agence ne préviennent que le mandant concerné', function (): void {
    $org = $this->org->id;
    $m = $this->mandant->id;
    $bob = User::factory()->create(['email' => 'bob@exemple.fr']);
    $autre = O::mandant($this->org, 'bob@exemple.fr');
    O::mandat($this->org, $autre);
    O::acces($this->org, $autre, $bob);

    PayoutExecuted::dispatch($org, 'b1', 'i1', 'RV-2026-0001', $m);
    PayoutReturned::dispatch($org, 'b1', 'i1', 'RV-2026-0001', $m);
    ApprovalExpired::dispatch('int1', 'ap1', $org, 'INT-1', $m);
    ApprovalDecided::dispatch('int1', 'ap1', 'accepted', $org, 'INT-1', 'agency_recorded', $m);
    ApprovalDecided::dispatch('int1', 'ap2', 'accepted', $org, 'INT-2', 'owner_space', $m);

    $types = N::types($this->awa);
    expect($types)->toContain('owner.payout_executed', 'owner.payout_returned', 'owner.approval_expired', 'owner.approval_recorded')
        ->and(collect($types)->filter(fn ($t) => $t === 'owner.approval_recorded')->count())->toBe(1)
        ->and(N::nombre($bob))->toBe(0)
        ->and(Notification::query()->where('user_id', $this->awa->id)->where('type', 'owner.payout_returned')->sole()->email)->toBeTrue();
});

it('prévient le mandant d\'un compte rendu publié seulement si l\'agence l\'a demandé', function (): void {
    ManagementReportPublished::dispatch('rep-1', $this->org->id, $this->mandant->id, false, false);
    expect(N::nombre($this->awa))->toBe(0);

    ManagementReportPublished::dispatch('rep-2', $this->org->id, $this->mandant->id, true, false);

    $n = N::premiere($this->awa, NotificationType::OwnerReportPublished);
    expect($n->link)->toBe('/comptes-rendus/rep-2')->and($n->dedup_key)->toBe('report:rep-2');
});
