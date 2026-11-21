<?php

declare(strict_types=1);

use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Events\NoticeRequestAcknowledged;
use App\Modules\Leases\Events\NoticeRequestClosed;
use App\Modules\Leases\Events\NoticeRequested;
use App\Modules\Leases\Events\NoticeRequestUnacknowledged;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Parties\Actions\AnonymizeParty;
use App\Modules\Parties\Models\Party;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantWriteContext as W;

const PDF_LETTRE = "%PDF-1.4\n% lettre de conge\n";

beforeEach(function (): void {
    config(['sanctum.stateful' => ['locataire.eguardimmo.test'], 'leases.gotenberg.url' => 'http://gotenberg.test', 'leases.gotenberg.timeout' => 5]);
    Http::fake(['gotenberg.test/*' => Http::response(PDF_LETTRE, 200)]);
    $this->w = W::monde($this);
    $this->org = $this->w['org'];
    $this->moi = $this->w['moi'];
    $this->lease = $this->moi['lease'];
    $this->base = "/api/v1/tenant/leases/{$this->lease->id}";
    $this->envoyer = function (array $corps = [], $compte = null, ?string $bail = null, bool $reauth = true, bool $limiter = false) {
        if (! $limiter) {
            Cache::flush();
        }
        T::comme($this, $compte ?? $this->moi['user']);
        $this->flushSession();

        return $this->withSession($reauth ? [EnsureRecentReauthentication::CLE_MOT_DE_PASSE => now()->getTimestamp()] : [])
            ->post('/api/v1/tenant/leases/'.($bail ?? $this->lease->id).'/notice-requests', [
                'reason_key' => 'standard',
                'requested_departure_on' => '2027-03-01',
                'consent_accepted' => '1',
                'consent_version' => config('leases.notice.consent_version'),
                'client_id' => (string) Str::uuid7(),
                ...$corps,
            ], ['Accept' => 'application/json', 'Origin' => 'https://locataire.eguardimmo.test', 'Referer' => 'https://locataire.eguardimmo.test/']);
    };
    $this->equipe = fn (string $chemin, string $methode = 'getJson', array $corps = [], $compte = null) => R::changerDeCompte($this, $compte ?? $this->w['manager'])
        ->{$methode}("/api/v1/org/{$this->org->id}{$chemin}", ...($methode === 'getJson' ? [] : [$corps]));
    $this->justificatif = fn () => UploadedFile::fake()->createWithContent('certificat.pdf', W::PDF);
    $this->lire = fn (string $id, $compte = null) => T::comme($this, $compte ?? $this->moi['user'])->getJson("/api/v1/tenant/notice-requests/{$id}");
});

it('annonce les motifs ouverts, leur premier départ indicatif et les textes à confirmer, sans le motif violences', function (): void {
    $vue = T::comme($this, $this->moi['user'])->getJson("{$this->base}/notice-options")->assertOk()->json('data');

    expect($vue['available'])->toBeTrue()->and($vue['unavailable_reason'])->toBeNull()->and($vue['to_confirm'])->toBeTrue()
        ->and($vue['consent']['version'])->toBe(config('leases.notice.consent_version'))
        ->and(collect($vue['reasons'])->pluck('key')->all())->not->toContain('domestic_violence')->toContain('standard', 'health', 'new_job_after_loss')
        ->and(collect($vue['reasons'])->firstWhere('key', 'standard'))->toMatchArray(['months' => 3, 'proof_required' => false, 'earliest_departure_on' => '2027-02-16'])
        ->and(collect($vue['reasons'])->firstWhere('key', 'health'))->toMatchArray(['months' => 1, 'proof_required' => true, 'earliest_departure_on' => '2026-12-16']);
});

it('dépose une demande : lettre figée avec empreinte, journal de preuve, bail intact, motif absent de l\'audit', function (): void {
    Event::fake([NoticeRequested::class]);
    $cree = ($this->envoyer)(['forwarding_address' => '12 rue des Lilas, 44000 Nantes'])->assertCreated();
    $id = $cree->json('data.id');

    expect($cree->json('data'))->toMatchArray(['status' => 'submitted', 'earliest_departure_on' => '2027-02-16', 'departure_is_indicative' => true, 'has_letter' => true, 'has_proof' => false, 'acknowledgement_overdue' => false])
        ->and(array_keys($cree->json('data')))->toBe(['id', 'lease_id', 'status', 'reason_key', 'requested_departure_on', 'earliest_departure_on', 'departure_is_indicative', 'received_on', 'has_proof', 'has_letter', 'forwarding_address', 'acknowledgement_overdue', 'closed_outcome', 'created_at', 'acknowledged_at', 'withdrawn_at', 'closed_at'])
        ->and((string) $cree->getContent())->not->toContain($this->moi['party']->id);
    Event::assertDispatched(NoticeRequested::class, fn ($e): bool => $e->requestId === $id && $e->leaseId === $this->lease->id);

    $demande = L::dans($this->org, fn () => LeaseNoticeRequest::query()->find($id));
    expect($demande->letter_fingerprint)->toBe(hash('sha256', PDF_LETTRE))
        ->and(DB::table('lease_notice_requests')->value('forwarding_address'))->not->toContain('Lilas')
        ->and(DB::table('issued_documents')->where('type', 'letter')->count())->toBe(1)
        ->and((string) DB::table('issued_documents')->where('type', 'letter')->value('snapshot'))->not->toContain('Lilas')->not->toContain('forwarding');
    Http::assertSent(fn ($requete): bool => str_contains((string) $requete->body(), 'Motif du préavis') && ! str_contains((string) $requete->body(), 'Lilas'));

    $lettre = T::comme($this, $this->moi['user'])->get("/api/v1/tenant/notice-requests/{$id}/letter")->assertOk();
    expect($lettre->streamedContent())->toBe(PDF_LETTRE);

    $journal = DB::table('lease_notice_request_events')->orderBy('occurred_at')->orderBy('id')->get();
    expect($journal->pluck('kind')->sort()->values()->all())->toBe(['letter_issued', 'submitted'])
        ->and($journal->firstWhere('kind', 'submitted')->reauth_method)->toBe('password')
        ->and($journal->firstWhere('kind', 'submitted')->consent_version)->toBe(config('leases.notice.consent_version'))
        ->and($journal->firstWhere('kind', 'submitted')->ip)->not->toBeNull()
        ->and((string) AuditLog::query()->pluck('metadata')->implode(''))->not->toContain('standard')->not->toContain('Lilas');

    $bail = L::dans($this->org, fn () => Lease::query()->find($this->lease->id));
    expect($bail->notice_received_on)->toBeNull()->and($bail->lock_version)->toBe(1)->and(W::actions())->toContain('leases.notice_request.submitted');
});

it('exige un justificatif pour un motif réduit, que seule l\'équipe de gestion peut lire, journalisé', function (): void {
    ($this->envoyer)(['reason_key' => 'health', 'requested_departure_on' => '2026-12-20'])->assertUnprocessable()->assertJsonPath('code', 'notice_proof_required');
    $id = ($this->envoyer)(['reason_key' => 'health', 'requested_departure_on' => '2026-12-20', 'proof' => ($this->justificatif)()])->assertCreated()->assertJsonPath('data.has_proof', true)->assertJsonPath('data.earliest_departure_on', '2026-12-16')->json('data.id');

    $preuve = ($this->equipe)("/notice-requests/{$id}/proof")->assertOk();
    expect($preuve->streamedContent())->toBe(W::PDF)->and(W::actions())->toContain('leases.notice_request.proof_downloaded');
    ($this->equipe)("/notice-requests/{$id}/proof", 'getJson', [], $this->w['accountant'])->assertForbidden();
    ($this->equipe)("/notice-requests/{$id}/proof", 'getJson', [], L::titulaire(T::organisation('Immo Loire')))->assertStatus(404);
    ($this->equipe)('/notice-requests/'.Str::uuid7().'/proof')->assertNotFound()->assertJsonPath('code', 'notice_request_not_found');
    expect(array_keys(($this->equipe)("/notice-requests/{$id}")->json('data')))->not->toContain('proof_file_id')
        ->and(DB::table('stored_files')->where('id', DB::table('lease_notice_requests')->where('id', $id)->value('proof_file_id'))->value('subject_type'))->toBe('tenant_space');
});

it('refuse un motif hors liste, le motif violences, un départ trop proche et un consentement absent', function (): void {
    ($this->envoyer)(['reason_key' => 'domestic_violence'])->assertUnprocessable()->assertJsonPath('code', 'notice_reason_unsupported');
    ($this->envoyer)(['reason_key' => 'inconnu'])->assertUnprocessable()->assertJsonPath('code', 'notice_reason_unsupported');
    ($this->envoyer)(['requested_departure_on' => '2027-02-15'])->assertUnprocessable()->assertJsonPath('code', 'notice_departure_too_early');
    ($this->envoyer)(['consent_accepted' => '0'])->assertUnprocessable();
    ($this->envoyer)(['consent_version' => 'ancienne'])->assertUnprocessable();
    ($this->envoyer)(['client_id' => 'x'])->assertUnprocessable();

    expect(DB::table('lease_notice_requests')->count())->toBe(0);
});

it('rejoue un dépôt identique, refuse un contenu différent et une seconde demande vivante, puis accepte après retrait', function (): void {
    $cle = (string) Str::uuid7();
    $id = ($this->envoyer)(['client_id' => $cle])->assertCreated()->json('data.id');
    ($this->envoyer)(['client_id' => $cle])->assertOk()->assertJsonPath('data.id', $id);
    ($this->envoyer)(['client_id' => $cle, 'requested_departure_on' => '2027-04-01'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    ($this->envoyer)()->assertConflict()->assertJsonPath('code', 'notice_request_exists');

    T::comme($this, $this->moi['user'])->deleteJson("/api/v1/tenant/notice-requests/{$id}")->assertOk()->assertJsonPath('data.status', 'withdrawn');
    T::comme($this, $this->moi['user'])->deleteJson("/api/v1/tenant/notice-requests/{$id}")->assertOk()->assertJsonPath('data.status', 'withdrawn');
    ($this->envoyer)()->assertCreated();

    expect(DB::table('lease_notice_requests')->count())->toBe(2)->and(DB::table('lease_notice_request_events')->where('kind', 'withdrawn')->count())->toBe(1);
});

it('n\'écrit rien quand la lettre ne peut pas être produite', function (): void {
    Http::swap(new Factory);
    Http::fake(['gotenberg.test/*' => Http::response('erreur', 500)]);

    ($this->envoyer)(['reason_key' => 'health', 'requested_departure_on' => '2026-12-20', 'proof' => ($this->justificatif)()])->assertStatus(503)->assertJsonPath('code', 'notice_letter_unavailable');

    expect(DB::table('lease_notice_requests')->count())->toBe(0)->and(DB::table('lease_notice_request_events')->count())->toBe(0)
        ->and(DB::table('issued_documents')->count())->toBe(0)->and(DB::table('stored_files')->count())->toBe(0);
});

it('refuse un bail terminé, un préavis déjà enregistré et une juridiction ou un régime sans parcours', function (): void {
    $fini = T::locataire($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2025-11-17'], [], $this->moi['user']);
    ($this->envoyer)([], null, $fini['lease']->id)->assertConflict()->assertJsonPath('code', 'lease_notice_not_allowed');

    $avecPreavis = T::locataire($this->org, ['notice_received_on' => '2026-11-01', 'notice_departure_on' => '2027-02-01'], [], $this->moi['user']);
    ($this->envoyer)([], null, $avecPreavis['lease']->id)->assertConflict()->assertJsonPath('code', 'lease_notice_not_allowed');

    $belge = T::locataire($this->org, ['jurisdiction' => 'BE', 'regime_key' => 'be.residential'], [], $this->moi['user']);
    ($this->envoyer)([], null, $belge['lease']->id)->assertUnprocessable()->assertJsonPath('code', 'lease_jurisdiction_unsupported');
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$belge['lease']->id}/notice-options")->assertOk()->assertJsonPath('data.available', false)->assertJsonPath('data.unavailable_reason', 'lease_jurisdiction_unsupported');

    $droitCommun = T::locataire($this->org, ['regime_key' => 'fr.common_law'], [], $this->moi['user']);
    ($this->envoyer)([], null, $droitCommun['lease']->id)->assertUnprocessable()->assertJsonPath('code', 'notice_reason_unsupported');
});

it('exige la réauthentification récente, refuse les non-locataires et limite à trois dépôts par jour', function (): void {
    ($this->envoyer)([], null, null, false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    ($this->envoyer)([], User::factory()->create())->assertForbidden();
    auth()->forgetGuards();
    $this->flushSession();
    $this->postJson("{$this->base}/notice-requests", [])->assertUnauthorized();
    $this->getJson('/api/v1/tenant/notice-requests')->assertUnauthorized();

    $this->travel(2)->days();
    foreach (range(1, 3) as $_) {
        $id = ($this->envoyer)(['requested_departure_on' => '2027-06-01'], null, null, true, true)->assertCreated()->json('data.id');
        T::comme($this, $this->moi['user'])->deleteJson("/api/v1/tenant/notice-requests/{$id}")->assertOk();
    }
    ($this->envoyer)(['requested_departure_on' => '2027-06-01'], null, null, true, true)->assertStatus(429);
});

it('cloisonne les colocataires et les organisations : 404 partout hors de sa fiche', function (): void {
    $id = ($this->envoyer)()->assertCreated()->json('data.id');
    $voisin = T::locataire($this->org);
    $autre = T::locataire(T::organisation('Immo Loire'));
    $coloc = T::colocataire($this->org, $this->lease);
    $compteColoc = User::factory()->create();
    L::dans($this->org, fn () => $coloc->forceFill(['user_id' => $compteColoc->id])->save());

    foreach ([$voisin['user'], $autre['user'], $compteColoc] as $intrus) {
        ($this->lire)($id, $intrus)->assertNotFound()->assertJsonPath('code', 'notice_request_not_found');
        T::comme($this, $intrus)->get("/api/v1/tenant/notice-requests/{$id}/letter")->assertNotFound();
        T::comme($this, $intrus)->deleteJson("/api/v1/tenant/notice-requests/{$id}")->assertNotFound();
        expect(T::comme($this, $intrus)->getJson('/api/v1/tenant/notice-requests')->assertOk()->json('data'))->toBe([]);
    }
    foreach ([$voisin['lease']->id, $autre['lease']->id] as $bail) {
        T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$bail}/notice-options")->assertNotFound()->assertJsonPath('code', 'lease_not_found');
        ($this->envoyer)([], null, $bail)->assertNotFound();
    }
    expect(T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/notice-requests')->json('data'))->toHaveCount(1);
});

it('laisse l\'agence accuser réception : le récépissé daté recalcule le premier départ', function (): void {
    Event::fake([NoticeRequestAcknowledged::class]);
    $id = ($this->envoyer)()->assertCreated()->json('data.id');

    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-17'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-10'])->assertUnprocessable()->assertJsonPath('code', 'lease_notice_invalid');
    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-16'], $this->w['accountant'])->assertForbidden();
    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-16'], L::titulaire(T::organisation('Immo Loire')))->assertStatus(404);

    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-16'])->assertOk()->assertJsonPath('data.status', 'acknowledged')->assertJsonPath('data.received_on', '2026-11-16')->assertJsonPath('data.acknowledged_by_user_id', $this->w['manager']->id);
    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-16'])->assertOk();
    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-15'])->assertConflict()->assertJsonPath('code', 'notice_request_locked');
    Event::assertDispatchedTimes(NoticeRequestAcknowledged::class, 1);

    ($this->lire)($id)->assertOk()->assertJsonPath('data.departure_is_indicative', false)->assertJsonPath('data.status', 'acknowledged');
    T::comme($this, $this->moi['user'])->deleteJson("/api/v1/tenant/notice-requests/{$id}")->assertConflict()->assertJsonPath('code', 'notice_request_locked');
    expect(DB::table('lease_notice_request_events')->where('kind', 'acknowledged')->count())->toBe(1);
});

it('clôture la demande quand l\'équipe enregistre le préavis qui la cite, et solde les autres', function (): void {
    Event::fake([NoticeRequestClosed::class]);
    $id = ($this->envoyer)(['reason_key' => 'health', 'requested_departure_on' => '2026-12-20', 'proof' => ($this->justificatif)()])->assertCreated()->json('data.id');
    $voisin = T::colocataire($this->org, $this->lease);
    $autreCompte = User::factory()->create();
    L::dans($this->org, fn () => $voisin->forceFill(['user_id' => $autreCompte->id])->save());
    $autreId = ($this->envoyer)(['requested_departure_on' => '2027-03-01'], $autreCompte)->assertCreated()->json('data.id');

    $corps = ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Raison de santé'];
    ($this->equipe)("/leases/{$this->lease->id}/notice", 'postJson', [...$corps, 'notice_request_id' => (string) Str::uuid7()])->assertNotFound()->assertJsonPath('code', 'notice_request_not_found');
    expect(L::dans($this->org, fn () => Lease::query()->find($this->lease->id)->notice_received_on))->toBeNull();

    ($this->equipe)("/leases/{$this->lease->id}/notice", 'postJson', [...$corps, 'notice_request_id' => $id])->assertOk()->assertJsonPath('data.notice.departure_on', '2026-12-10');

    $demandes = DB::table('lease_notice_requests')->pluck('closed_outcome', 'id');
    expect($demandes[$id])->toBe('recorded')->and($demandes[$autreId])->toBe('superseded')
        ->and(DB::table('lease_notice_request_events')->where('kind', 'closed')->count())->toBe(2)
        ->and(W::actions())->toContain('leases.notice_request.closed');
    Event::assertDispatchedTimes(NoticeRequestClosed::class, 2);
    ($this->lire)($id)->assertOk()->assertJsonPath('data.status', 'closed')->assertJsonPath('data.closed_outcome', 'recorded');
});

it('clôture la demande d\'un colocataire quand l\'équipe acte son départ, sans toucher à celle des autres', function (): void {
    $id = ($this->envoyer)()->assertCreated()->json('data.id');
    $voisin = T::colocataire($this->org, $this->lease);
    $autreCompte = User::factory()->create();
    L::dans($this->org, fn () => $voisin->forceFill(['user_id' => $autreCompte->id])->save());
    $autreId = ($this->envoyer)(['requested_departure_on' => '2027-03-01'], $autreCompte)->assertCreated()->json('data.id');
    $ligne = $this->moi['line'];
    $url = "/leases/{$this->lease->id}/parties/{$ligne->id}/end";

    ($this->equipe)($url, 'postJson', ['lock_version' => 1, 'valid_to' => '2027-03-01', 'notice_request_id' => $autreId])->assertNotFound()->assertJsonPath('code', 'notice_request_not_found');
    ($this->equipe)($url, 'postJson', ['lock_version' => 1, 'valid_to' => '2027-03-01', 'notice_request_id' => $id])->assertOk();

    $demandes = DB::table('lease_notice_requests')->pluck('status', 'id');
    expect($demandes[$id])->toBe('closed')->and($demandes[$autreId])->toBe('submitted')->and(DB::table('lease_notice_requests')->where('id', $id)->value('closed_outcome'))->toBe('recorded');
});

it('refuse de clore avec la demande d\'un autre bail de la même organisation', function (): void {
    $voisin = T::locataire($this->org);
    $autreId = ($this->envoyer)(['requested_departure_on' => '2027-03-01'], $voisin['user'], $voisin['lease']->id)->assertCreated()->json('data.id');

    ($this->equipe)("/leases/{$this->lease->id}/notice", 'postJson', ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation', 'notice_request_id' => $autreId])->assertNotFound()->assertJsonPath('code', 'notice_request_not_found');

    expect(DB::table('lease_notice_requests')->where('id', $autreId)->value('status'))->toBe('submitted');
});

it('solde les demandes vivantes quand le préavis est enregistré sans les citer', function (): void {
    $id = ($this->envoyer)()->assertCreated()->json('data.id');

    ($this->equipe)("/leases/{$this->lease->id}/notice", 'postJson', ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Courrier recommandé'])->assertOk();

    expect(DB::table('lease_notice_requests')->where('id', $id)->value('closed_outcome'))->toBe('superseded');
});

it('signale une seule fois une demande sans accusé après deux jours ouvrés, week-end exclu', function (): void {
    Event::fake([NoticeRequestUnacknowledged::class]);
    $this->travelTo('2026-11-20 10:00:00');
    $id = ($this->envoyer)(['requested_departure_on' => '2027-03-01'])->assertCreated()->json('data.id');
    $reconnu = ($this->envoyer)(['requested_departure_on' => '2027-03-01'], T::locataire($this->org)['user'], null, true);
    expect($reconnu->status())->toBe(404);

    $this->travelTo('2026-11-22 12:00:00');
    $this->artisan('leases:flag-unacknowledged-notices')->assertSuccessful();
    $this->travelTo('2026-11-23 10:01:00');
    $this->artisan('leases:flag-unacknowledged-notices')->assertSuccessful();
    Event::assertNotDispatched(NoticeRequestUnacknowledged::class);
    ($this->lire)($id)->assertJsonPath('data.acknowledgement_overdue', false);

    $this->travelTo('2026-11-24 10:01:00');
    $this->artisan('leases:flag-unacknowledged-notices')->assertSuccessful();
    $this->artisan('leases:flag-unacknowledged-notices')->assertSuccessful();
    Event::assertDispatchedTimes(NoticeRequestUnacknowledged::class, 1);
    ($this->lire)($id)->assertJsonPath('data.acknowledgement_overdue', true);
    expect(DB::table('lease_notice_request_events')->where('kind', 'late_flagged')->count())->toBe(1);
});

it('ne signale pas une demande acquittée ou retirée', function (): void {
    Event::fake([NoticeRequestUnacknowledged::class]);
    $id = ($this->envoyer)()->assertCreated()->json('data.id');
    ($this->equipe)("/notice-requests/{$id}/acknowledge", 'postJson', ['received_on' => '2026-11-16'])->assertOk();

    $this->travel(10)->days();
    $this->artisan('leases:flag-unacknowledged-notices')->assertSuccessful();

    Event::assertNotDispatched(NoticeRequestUnacknowledged::class);
});

it('tient le journal de preuve en ajout seul', function (): void {
    ($this->envoyer)()->assertCreated();

    expect(fn () => DB::table('lease_notice_request_events')->update(['kind' => 'closed']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('lease_notice_request_events')->delete())->toThrow(QueryException::class)
        ->and(DB::table('lease_notice_request_events')->count())->toBe(2);
});

it('liste les demandes pour l\'équipe de gestion seulement, filtrées par état', function (): void {
    $id = ($this->envoyer)()->assertCreated()->json('data.id');

    expect(($this->equipe)('/notice-requests?status=submitted')->assertOk()->json('data.0.id'))->toBe($id)
        ->and(($this->equipe)('/notice-requests?status=closed')->assertOk()->json('data'))->toBe([]);
    ($this->equipe)('/notice-requests?status=bidon')->assertUnprocessable();
    ($this->equipe)('/notice-requests', 'getJson', [], $this->w['accountant'])->assertForbidden();
    ($this->equipe)('/notice-requests', 'getJson', [], L::titulaire(T::organisation('Immo Loire')))->assertStatus(404);
    auth()->forgetGuards();
    $this->getJson("/api/v1/org/{$this->org->id}/notice-requests")->assertUnauthorized();
    expect(IssuedDocument::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('efface l\'adresse de réexpédition d\'une fiche anonymisée, garde la demande, la lettre et le journal, et se rejoue sans effet', function (): void {
    $id = ($this->envoyer)(['forwarding_address' => '12 rue des Lilas, 44000 Nantes'])->assertCreated()->json('data.id');
    expect(L::dans($this->org, fn () => LeaseNoticeRequest::query()->findOrFail($id)->forwarding_address))->toBe('12 rue des Lilas, 44000 Nantes');

    $anonymiser = fn () => L::dans($this->org, fn () => app(AnonymizeParty::class)->handle(Party::query()->findOrFail($this->moi['party']->id), 'requested'));
    $anonymiser();

    $demande = L::dans($this->org, fn () => LeaseNoticeRequest::query()->findOrFail($id));
    expect($demande->forwarding_address)->toBeNull()->and($demande->letter_file_id)->not->toBeNull()->and($demande->status->value)->toBe('submitted')
        ->and(DB::table('lease_notice_request_events')->where('notice_request_id', $id)->count())->toBeGreaterThan(0)
        ->and((string) json_encode(DB::table('lease_notice_request_events')->pluck('data')->all()))->not->toContain('Lilas')
        ->and(W::actions())->toContain('leases.notice_requests.erased')
        ->and(DB::table('lease_notice_requests')->where('id', $id)->value('forwarding_address'))->toBeNull();

    $avant = DB::table('audit_logs')->where('action', 'leases.notice_requests.erased')->count();
    $anonymiser();

    expect(DB::table('audit_logs')->where('action', 'leases.notice_requests.erased')->count())->toBe($avant);
});
