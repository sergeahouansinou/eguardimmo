<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Owner\OwnerWriteContext as W;

beforeEach(function (): void {
    ['scene' => $this->scene, 'awa' => $this->awa] = W::agence($this);
    $this->org = $this->scene['org'];
    $this->mandat = $this->scene['mandate'];
    $this->agence = L::titulaire($this->org);
    $this->actingAs($this->agence);
    $this->url = fn (?string $mandat = null, string $suite = '') => C::url($this->org, '/mandates/'.($mandat ?? $this->mandat->id).$suite);
    $this->demande = fn (array $attributs = []): MandateEndRequest => M::dans($this->org, fn (): MandateEndRequest => MandateEndRequest::query()->create([
        'mandate_id' => $this->mandat->id,
        'mandant_party_id' => $this->scene['mandant']->id,
        'access_id' => (string) Str::uuid7(),
        'requested_by_user_id' => $this->awa->id,
        'status' => EndRequestStatus::Pending,
        'reason' => 'Je vends',
        ...$attributs,
    ]));
    $this->rejeter = fn (array $corps = [], ?string $mandat = null) => $this->postJson(($this->url)($mandat, '/end-request/dismiss'), $corps);
    $this->resilier = fn () => $this->postJson(($this->url)(null, '/terminate'), [
        'lock_version' => M::relire($this->org, $this->mandat)->lock_version,
        'notice_given_on' => '2026-11-18',
        'effective_on' => '2026-12-31',
        'reason' => 'Demande du mandant',
        'amicable' => true,
    ]);
    $this->relire = fn (string $id): MandateEndRequest => M::dans($this->org, fn () => MandateEndRequest::query()->findOrFail($id));
    $this->audits = fn (string $action): int => AuditLog::query()->where('action', $action)->count();
});

it('rejette la demande : statut, note, auteur, audit sans la note, mandat inchangé', function (): void {
    $demande = ($this->demande)();
    $avant = M::relire($this->org, $this->mandat);

    $reponse = ($this->rejeter)(['note' => '  Mandat exclusif en cours  '])->assertOk();

    $relue = ($this->relire)($demande->id);
    $apres = M::relire($this->org, $this->mandat);

    expect($reponse->json('data.id'))->toBe($demande->id)->and($reponse->json('data.status'))->toBe('dismissed')
        ->and($reponse->json('data.decision_note'))->toBe('Mandat exclusif en cours')->and($reponse->json('data.decided_at'))->not->toBeNull()
        ->and($relue->status)->toBe(EndRequestStatus::Dismissed)->and($relue->decided_by_user_id)->toBe($this->agence->id)
        ->and($apres->status)->toBe($avant->status)->and($apres->lock_version)->toBe($avant->lock_version)
        ->and(($this->audits)('mandates.end_request.dismissed'))->toBe(1);

    $audit = AuditLog::query()->where('action', 'mandates.end_request.dismissed')->sole();
    expect($audit->actor_user_id)->toBe($this->agence->id)->and(json_encode($audit->metadata))->not->toContain('exclusif');
});

it('prévient le mandant par le centre et par e-mail, sans la note ni son nom', function (): void {
    ($this->demande)();

    ($this->rejeter)(['note' => 'Note confidentielle'])->assertOk();

    $n = N::premiere($this->awa, NotificationType::OwnerMandateEndDismissed);
    expect($n->link)->toBe("/mandats/{$this->mandat->id}")->and($n->title.' '.$n->body)->not->toContain('confidentielle')->not->toContain($this->scene['mandant']->display_name)
        ->and($n->body)->toContain($this->mandat->reference);
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($this->awa->email) && ! str_contains($m->corps, 'confidentielle'));
});

it('est rejouable : la demande déjà rejetée est renvoyée en 200, sans second audit, seconde notification ni changement de note', function (): void {
    $demande = ($this->demande)();

    ($this->rejeter)(['note' => 'Première note'])->assertOk();
    ($this->rejeter)(['note' => 'Seconde note'])->assertOk()->assertJsonPath('data.id', $demande->id)->assertJsonPath('data.decision_note', 'Première note');

    expect(($this->audits)('mandates.end_request.dismissed'))->toBe(1)->and(N::nombre($this->awa, NotificationType::OwnerMandateEndDismissed))->toBe(1);
});

it('refuse en 409 une demande annulée ou satisfaite, en 404 sans aucune demande, sans rien écrire', function (): void {
    ($this->rejeter)()->assertNotFound()->assertJsonPath('code', 'mandate_end_request_not_found');

    $annulee = ($this->demande)(['status' => EndRequestStatus::Cancelled, 'cancelled_at' => now()]);
    ($this->rejeter)()->assertConflict()->assertJsonPath('code', 'mandate_end_request_not_pending');
    expect(($this->relire)($annulee->id)->status)->toBe(EndRequestStatus::Cancelled);

    ($this->demande)(['status' => EndRequestStatus::Fulfilled, 'decided_at' => now()]);
    ($this->rejeter)()->assertConflict()->assertJsonPath('code', 'mandate_end_request_not_pending');

    expect(($this->audits)('mandates.end_request.dismissed'))->toBe(0)->and(N::nombre($this->awa, NotificationType::OwnerMandateEndDismissed))->toBe(0);
});

it('valide la note : 500 caractères au plus, vide devenue null', function (): void {
    $demande = ($this->demande)();

    ($this->rejeter)(['note' => str_repeat('a', 501)])->assertUnprocessable()->assertJsonValidationErrors('note');
    expect(($this->relire)($demande->id)->status)->toBe(EndRequestStatus::Pending);

    ($this->rejeter)(['note' => '   '])->assertOk()->assertJsonPath('data.decision_note', null);
});

it('refuse le comptable et le non-membre ; le gestionnaire peut rejeter', function (): void {
    $demande = ($this->demande)();

    $this->actingAs(M::membre($this->org, MemberRole::Accountant));
    ($this->rejeter)()->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    $this->actingAs(M::titulaire(M::organisation()));
    ($this->rejeter)()->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    expect(($this->relire)($demande->id)->status)->toBe(EndRequestStatus::Pending);

    $this->actingAs(M::membre($this->org, MemberRole::Manager));
    ($this->rejeter)()->assertOk()->assertJsonPath('data.status', 'dismissed');
});

it('ne laisse pas rejeter la demande d\'un mandat d\'une autre agence', function (): void {
    $demande = ($this->demande)();
    $autre = M::organisation();
    $etranger = M::actif($autre, M::lot($autre), M::partie($autre));

    $this->actingAs(M::titulaire($autre));
    $this->postJson(C::url($autre, "/mandates/{$this->mandat->id}/end-request/dismiss"))->assertNotFound()->assertJsonPath('code', 'mandate_not_found');
    $this->postJson(C::url($autre, "/mandates/{$etranger->id}/end-request/dismiss"))->assertNotFound()->assertJsonPath('code', 'mandate_end_request_not_found');

    expect(($this->relire)($demande->id)->status)->toBe(EndRequestStatus::Pending);
});

it('la résiliation clôt la demande vivante (satisfaite) et prévient le mandant, sans écrire sur un mandat sans demande', function (): void {
    $demande = ($this->demande)();

    ($this->resilier)()->assertOk()->assertJsonPath('data.status', 'terminated')->assertJsonPath('data.has_end_request', false);

    $relue = ($this->relire)($demande->id);
    expect($relue->status)->toBe(EndRequestStatus::Fulfilled)->and($relue->decided_by_user_id)->toBe($this->agence->id)->and($relue->decided_at)->not->toBeNull()
        ->and(($this->audits)('mandates.end_request.fulfilled'))->toBe(1)
        ->and(N::nombre($this->awa, NotificationType::OwnerMandateEndFulfilled))->toBe(1)
        ->and(N::premiere($this->awa, NotificationType::OwnerMandateEndFulfilled)->dedup_key)->toBe("mandate-end:{$demande->id}:fulfilled");
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($this->awa->email) && str_contains($m->titre, 'Fin de mandat acceptée'));

    ($this->rejeter)()->assertConflict()->assertJsonPath('code', 'mandate_end_request_not_pending');
});

it('la résiliation sans demande ne crée ni audit de demande ni notification', function (): void {
    ($this->resilier)()->assertOk();

    expect(($this->audits)('mandates.end_request.fulfilled'))->toBe(0)->and(N::nombre($this->awa, NotificationType::OwnerMandateEndFulfilled))->toBe(0);
});

it('une résiliation refusée (préavis non respecté) laisse la demande vivante', function (): void {
    $demande = ($this->demande)();

    $this->postJson(($this->url)(null, '/terminate'), [
        'lock_version' => M::relire($this->org, $this->mandat)->lock_version,
        'notice_given_on' => '2026-11-18',
        'effective_on' => '2026-11-19',
        'reason' => 'Trop tôt',
    ])->assertUnprocessable();

    expect(($this->relire)($demande->id)->status)->toBe(EndRequestStatus::Pending)->and(M::relire($this->org, $this->mandat)->status)->toBe(MandateStatus::Active);
});

it('filtre la liste sur les mandats à demande vivante et expose has_end_request', function (): void {
    $sans = M::actif($this->org, M::lot($this->org), M::partie($this->org));
    ($this->demande)();

    $tous = $this->getJson(C::url($this->org, '/mandates?per_page=50'))->assertOk();
    $filtre = $this->getJson(C::url($this->org, '/mandates?end_request=pending'))->assertOk();
    $parId = collect($tous->json('data'))->pluck('has_end_request', 'id');

    expect($parId[$this->mandat->id])->toBeTrue()->and($parId[$sans->id])->toBeFalse()
        ->and(collect($filtre->json('data'))->pluck('id')->all())->toBe([$this->mandat->id]);

    ($this->rejeter)()->assertOk();

    expect($this->getJson(C::url($this->org, '/mandates?end_request=pending'))->assertOk()->json('data'))->toBe([])
        ->and($this->getJson(($this->url)())->assertOk()->json('data.has_end_request'))->toBeFalse();
    $this->getJson(C::url($this->org, '/mandates?end_request=all'))->assertUnprocessable()->assertJsonValidationErrors('end_request');
});

it('le filtre ne montre pas les demandes d\'une autre agence', function (): void {
    ($this->demande)();
    $autre = M::organisation();
    M::actif($autre, M::lot($autre), M::partie($autre));

    $this->actingAs(M::titulaire($autre));

    expect($this->getJson(C::url($autre, '/mandates?end_request=pending'))->assertOk()->json('data'))->toBe([]);
});
