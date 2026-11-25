<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerWriteContext as W;

const CLES_DEMANDE = ['id', 'mandate_id', 'status', 'reason', 'requested_at', 'cancelled_at', 'decided_at', 'decision_note'];

beforeEach(function (): void {
    ['scene' => $this->scene, 'awa' => $this->awa] = W::agence($this);
    $this->org = $this->scene['org'];
    $this->mandat = $this->scene['mandate'];
    $this->agence = L::titulaire($this->org);
    $this->actingAs($this->agence);
    $this->url = fn (?string $mandat = null) => C::url($this->org, '/mandates/'.($mandat ?? $this->mandat->id).'/end-request');
    $this->demande = fn (array $attributs = [], ?string $creeeLe = null): MandateEndRequest => M::dans($this->org, function () use ($attributs, $creeeLe): MandateEndRequest {
        $demande = new MandateEndRequest([
            'mandate_id' => $this->mandat->id,
            'mandant_party_id' => $this->scene['mandant']->id,
            'access_id' => (string) Str::uuid7(),
            'requested_by_user_id' => $this->awa->id,
            'status' => EndRequestStatus::Pending,
            'reason' => 'Je vends',
            ...$attributs,
        ]);

        if ($creeeLe !== null) {
            $demande->created_at = now()->parse($creeeLe);
        }

        $demande->save();

        return $demande;
    });
});

it('renvoie null quand le mandat n\'a jamais eu de demande', function (): void {
    $this->getJson(($this->url)())->assertOk()->assertExactJson(['data' => null]);
});

it('renvoie la demande en attente avec le contrat complet', function (): void {
    $demande = ($this->demande)();

    $data = $this->getJson(($this->url)())->assertOk()->json('data');

    expect(array_keys($data))->toBe(CLES_DEMANDE)
        ->and($data['id'])->toBe($demande->id)->and($data['mandate_id'])->toBe($this->mandat->id)->and($data['status'])->toBe('pending')
        ->and($data['reason'])->toBe('Je vends')->and($data['requested_at'])->toBe($demande->created_at->toIso8601String())
        ->and($data['cancelled_at'])->toBeNull()->and($data['decided_at'])->toBeNull()->and($data['decision_note'])->toBeNull();
});

it('renvoie la demande rejetée avec sa note après décision de l\'agence', function (): void {
    $demande = ($this->demande)();
    $this->postJson(($this->url)().'/dismiss', ['note' => 'Exclusivité en cours'])->assertOk();

    $data = $this->getJson(($this->url)())->assertOk()->json('data');

    expect($data['id'])->toBe($demande->id)->and($data['status'])->toBe('dismissed')->and($data['decision_note'])->toBe('Exclusivité en cours')
        ->and($data['decided_at'])->not->toBeNull()->and($data['cancelled_at'])->toBeNull();
});

it('renvoie la demande satisfaite après résiliation du mandat', function (): void {
    $demande = ($this->demande)();
    $this->postJson(C::url($this->org, "/mandates/{$this->mandat->id}/terminate"), [
        'lock_version' => M::relire($this->org, $this->mandat)->lock_version,
        'notice_given_on' => '2026-11-18',
        'effective_on' => '2026-12-31',
        'reason' => 'Demande du mandant',
        'amicable' => true,
    ])->assertOk();

    $data = $this->getJson(($this->url)())->assertOk()->json('data');

    expect($data['id'])->toBe($demande->id)->and($data['status'])->toBe('fulfilled')->and($data['decided_at'])->not->toBeNull()->and($data['decision_note'])->toBeNull();
});

it('renvoie la demande annulée par le mandant', function (): void {
    $demande = ($this->demande)();
    Cache::flush();
    O::preuve($this);
    O::comme($this, $this->awa)->deleteJson('/api/v1/owner/mandates/'.$this->mandat->id.'/end-request', [], O::ORIGINE)->assertOk();

    $this->actingAs($this->agence);
    $data = $this->getJson(($this->url)())->assertOk()->json('data');

    expect($data['id'])->toBe($demande->id)->and($data['status'])->toBe('cancelled')->and($data['cancelled_at'])->not->toBeNull()->and($data['decision_note'])->toBeNull();
});

it('renvoie la plus récente quand plusieurs demandes se sont succédé, en attente comprise', function (): void {
    ($this->demande)(['status' => EndRequestStatus::Cancelled, 'cancelled_at' => now()->subDays(5)], '-6 days');
    $rejetee = ($this->demande)(['status' => EndRequestStatus::Dismissed, 'decided_at' => now()->subDays(2), 'decision_note' => 'Non'], '-3 days');

    expect($this->getJson(($this->url)())->assertOk()->json('data.id'))->toBe($rejetee->id);

    $vivante = ($this->demande)([], '-1 day');

    expect($this->getJson(($this->url)())->assertOk()->json('data.id'))->toBe($vivante->id);
});

it('401 sans jeton, 404 pour un non-membre et pour le mandat d\'une autre agence, sans fuite de la demande', function (): void {
    $demande = ($this->demande)(['status' => EndRequestStatus::Dismissed, 'decided_at' => now(), 'decision_note' => 'Secrète']);

    $this->app['auth']->forgetGuards();
    $this->withHeaders([])->getJson(($this->url)())->assertUnauthorized();

    M::basculer($this, M::membre($this->org, MemberRole::Accountant));
    $this->getJson(($this->url)())->assertOk()->assertJsonPath('data.id', $demande->id);

    $autre = M::organisation();
    M::basculer($this, M::titulaire($autre));
    $this->getJson(($this->url)())->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    M::basculer($this, M::titulaire($autre));
    $this->getJson(C::url($autre, "/mandates/{$this->mandat->id}/end-request"))->assertNotFound()->assertJsonPath('code', 'mandate_not_found');
});

it('le propriétaire ne voit jamais la note de décision, ni dans la demande ni dans son mandat', function (): void {
    ($this->demande)(['decision_note' => 'Note interne agence']);
    Cache::flush();

    $fiche = O::comme($this, $this->awa)->getJson('/api/v1/owner/mandates/'.$this->mandat->id)->assertOk();
    $liste = O::comme($this, $this->awa)->getJson('/api/v1/owner/mandates')->assertOk();

    expect($fiche->json('data.end_request'))->not->toBeNull()->and($fiche->json('data.end_request'))->not->toHaveKey('decision_note')
        ->and($fiche->getContent())->not->toContain('Note interne')->and($liste->getContent())->not->toContain('Note interne');

    O::preuve($this);
    $annulee = O::comme($this, $this->awa)->deleteJson('/api/v1/owner/mandates/'.$this->mandat->id.'/end-request', [], O::ORIGINE)->assertOk();

    expect($annulee->json('data'))->not->toHaveKey('decision_note')->and($annulee->getContent())->not->toContain('Note interne');
});

it('le propriétaire ne voit toujours que la demande en attente', function (): void {
    ($this->demande)(['status' => EndRequestStatus::Dismissed, 'decided_at' => now(), 'decision_note' => 'Non']);

    O::comme($this, $this->awa)->getJson('/api/v1/owner/mandates/'.$this->mandat->id)->assertOk()->assertJsonPath('data.end_request', null);
});
