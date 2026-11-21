<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Mandates\Events\MandateDocumentShared;
use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    Storage::fake('documents');
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
    $this->mandat = M::actif($this->org, $this->lot, $this->partie);
    $this->avenant = fn (array $corps = []) => $this->postJson(M::url($this->org, "/{$this->mandat->id}/terms"), [
        'lock_version' => M::relire($this->org, $this->mandat)->lock_version,
        'effective_on' => '2027-01-01',
        'fee_basis_points' => 650,
        ...$corps,
    ]);
    $this->etat = fn (): array => M::dans($this->org, fn (): array => [
        MandateTerm::query()->count(),
        MandateDocument::query()->count(),
        M::relire($this->org, $this->mandat)->lock_version,
    ]);
});

it('exige la pièce signée : sans pièce, rien n\'est écrit', function (): void {
    $avant = ($this->etat)();

    ($this->avenant)()->assertUnprocessable()->assertJsonPath('code', 'mandate_amendment_signature_required');
    ($this->avenant)(['signed_file_id' => null])->assertUnprocessable()->assertJsonPath('code', 'mandate_amendment_signature_required');
    ($this->avenant)(['signed_file_id' => 'pas-un-uuid'])->assertUnprocessable()->assertJsonValidationErrors('signed_file_id');
    ($this->avenant)(['signed_file_id' => (string) fake()->uuid()])->assertUnprocessable()->assertJsonPath('code', 'mandate_amendment_signature_required');

    expect(($this->etat)())->toBe($avant);
});

it('refuse une pièce d\'un autre mandat, d\'une autre organisation, sans objet ou d\'une autre catégorie', function (): void {
    $autreMandat = M::actif($this->org, M::lot($this->org), M::partie($this->org));
    $etrangere = M::organisation();
    $mandatEtranger = M::actif($etrangere, M::lot($etrangere), M::partie($etrangere));
    $sansObjet = M::dans($this->org, fn (): string => app(DocumentStore::class)->store(
        FileSource::contents(DocumentsContext::PDF), 'libre.pdf', FileCategory::Supporting,
    )->id);
    $certificat = M::dans($this->org, fn (): string => app(DocumentStore::class)->store(
        FileSource::contents(DocumentsContext::PDF), 'attestation.pdf', FileCategory::Certificate,
        new DocumentSubject('mandate', $this->mandat->id),
    )->id);
    $avant = ($this->etat)();

    foreach ([M::pieceSignee($this->org, $autreMandat), M::pieceSignee($etrangere, $mandatEtranger), $sansObjet, $certificat] as $fichier) {
        ($this->avenant)(['signed_file_id' => $fichier])->assertUnprocessable()->assertJsonPath('code', 'mandate_amendment_signature_required');
    }

    expect(($this->etat)())->toBe($avant);
});

it('refuse une pièce pas encore analysée ou infectée : 409 document_not_clean, rien n\'est écrit', function (string $statut): void {
    $fichier = M::pieceSignee($this->org, $this->mandat);
    AcrossOrganizations::query(StoredFile::class)->whereKey($fichier)->update(['scan_status' => $statut]);
    $avant = ($this->etat)();

    ($this->avenant)(['signed_file_id' => $fichier])->assertConflict()->assertJsonPath('code', 'document_not_clean');

    expect(($this->etat)())->toBe($avant);
})->with(['pending', 'unverifiable', 'infected']);

it('enregistre l\'avenant avec sa pièce, la partage d\'office avec le mandant et journalise sans montant', function (): void {
    $fichier = M::pieceSignee($this->org, $this->mandat);
    Event::fake([MandateDocumentShared::class]);

    ($this->avenant)(['signed_file_id' => $fichier])->assertOk()
        ->assertJsonPath('data.terms_history.0.signed_file_id', null)
        ->assertJsonPath('data.terms_history.1.signed_file_id', $fichier)
        ->assertJsonPath('data.terms_history.1.fee_basis_points', 650);

    $piece = M::dans($this->org, fn () => MandateDocument::query()->where('mandate_id', $this->mandat->id)->firstOrFail());
    expect($piece->stored_file_id)->toBe($fichier)
        ->and($piece->kind->value)->toBe('amendment')
        ->and($piece->uploaded_by_kind->value)->toBe('agency')
        ->and($piece->shared_at?->toIso8601String())->toBe(now()->toIso8601String())
        ->and($piece->revoked_at)->toBeNull()
        ->and($piece->shared_by_user_id)->toBe(M::titulaire($this->org)->id);
    Event::assertDispatchedTimes(MandateDocumentShared::class, 1);
    Event::assertDispatched(MandateDocumentShared::class, fn (MandateDocumentShared $e): bool => $e->documentId === $piece->id && $e->mandateId === $this->mandat->id);

    $ligne = AuditLog::query()->where('action', 'mandates.terms.amended')->sole();
    expect($ligne->metadata['signed_file_id'])->toBe($fichier)
        ->and(array_keys($ligne->metadata))->toEqualCanonicalizing(['mandate_id', 'effective_on', 'signed_file_id', 'document_id'])
        ->and(array_filter($ligne->metadata, fn (mixed $valeur): bool => is_int($valeur) || is_float($valeur) || $valeur === '650'))->toBe([]);
});

it('une pièce signée ne sert qu\'une fois', function (): void {
    $fichier = M::pieceSignee($this->org, $this->mandat);
    ($this->avenant)(['signed_file_id' => $fichier])->assertOk();

    ($this->avenant)(['effective_on' => '2027-06-01', 'fee_basis_points' => 600, 'signed_file_id' => $fichier])
        ->assertUnprocessable()->assertJsonPath('code', 'mandate_amendment_signature_required');
    expect(M::dans($this->org, fn () => MandateTerm::query()->where('mandate_id', $this->mandat->id)->count()))->toBe(2);

    ($this->avenant)(['effective_on' => '2027-06-01', 'fee_basis_points' => 600, 'signed_file_id' => M::pieceSignee($this->org, $this->mandat)])->assertOk();
});

it('une version périmée ou un avenant hors délai passent avant la pièce et ne consomment rien', function (): void {
    $fichier = M::pieceSignee($this->org, $this->mandat);
    $avant = ($this->etat)();

    ($this->avenant)(['signed_file_id' => $fichier, 'lock_version' => 9])->assertConflict()->assertJsonPath('code', 'mandate_stale_version');
    ($this->avenant)(['signed_file_id' => $fichier, 'effective_on' => '2026-11-15'])->assertUnprocessable()->assertJsonValidationErrors('effective_on');

    expect(($this->etat)())->toBe($avant);
});

it('enregistre les honoraires de relocation et de suivi de travaux en points de base entiers, et les vide par null', function (): void {
    ($this->avenant)(['signed_file_id' => M::pieceSignee($this->org, $this->mandat), 'letting_fee_basis_points' => 10000, 'works_fee_basis_points' => 500, 'fee_basis_points' => null])
        ->assertOk()
        ->assertJsonPath('data.terms_history.1.letting_fee_basis_points', 10000)
        ->assertJsonPath('data.terms_history.1.works_fee_basis_points', 500)
        ->assertJsonPath('data.terms_history.1.fee_basis_points', 700);

    ($this->avenant)(['effective_on' => '2027-03-01', 'fee_basis_points' => null, 'signed_file_id' => M::pieceSignee($this->org, $this->mandat), 'works_fee_basis_points' => null])
        ->assertOk()
        ->assertJsonPath('data.terms_history.2.letting_fee_basis_points', 10000)
        ->assertJsonPath('data.terms_history.2.works_fee_basis_points', null);

    ($this->avenant)(['effective_on' => '2027-04-01', 'fee_basis_points' => null, 'signed_file_id' => M::pieceSignee($this->org, $this->mandat), 'letting_fee_basis_points' => 10001])
        ->assertUnprocessable()->assertJsonValidationErrors('letting_fee_basis_points');
    ($this->avenant)(['effective_on' => '2027-04-01', 'fee_basis_points' => null, 'signed_file_id' => M::pieceSignee($this->org, $this->mandat), 'works_fee_basis_points' => 1.5])
        ->assertUnprocessable()->assertJsonValidationErrors('works_fee_basis_points');
});

it('refuse un avenant qui ne modifie rien, même avec une pièce', function (): void {
    $this->postJson(M::url($this->org, "/{$this->mandat->id}/terms"), [
        'lock_version' => 1, 'effective_on' => '2027-01-01', 'signed_file_id' => M::pieceSignee($this->org, $this->mandat),
    ])->assertUnprocessable()->assertJsonValidationErrors('fee_kind');
});

it('crée un mandat avec ses honoraires de relocation et de suivi de travaux, base obligatoire', function (): void {
    $lot = M::lot($this->org);
    $terms = ['fee_kind' => 'percentage', 'fee_basis_points' => 700, 'payout_day' => 5, 'fee_base' => 'rent_and_charges', 'letting_fee_basis_points' => 10000, 'works_fee_basis_points' => 300];

    $this->postJson(M::url($this->org), M::payload($lot, $this->partie, ['terms' => $terms]))->assertCreated()
        ->assertJsonPath('data.terms.fee_base', 'rent_and_charges')
        ->assertJsonPath('data.terms.letting_fee_basis_points', 10000)
        ->assertJsonPath('data.terms.works_fee_basis_points', 300);

    foreach ([['fee_base' => null], ['letting_fee_basis_points' => 10001], ['works_fee_basis_points' => -1]] as $change) {
        $this->postJson(M::url($this->org), M::payload(M::lot($this->org), $this->partie, ['terms' => [...$terms, ...$change]]))->assertUnprocessable();
    }

    unset($terms['fee_base']);
    $this->postJson(M::url($this->org), M::payload(M::lot($this->org), $this->partie, ['terms' => $terms]))->assertUnprocessable()->assertJsonValidationErrors('terms.fee_base');
});

it('le comptable ne peut pas poser d\'avenant, même signé', function (): void {
    M::basculer($this, M::membre($this->org, MemberRole::Accountant));
    $avant = ($this->etat)();

    ($this->avenant)(['signed_file_id' => M::pieceSignee($this->org, $this->mandat)])->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    expect(($this->etat)())->toBe($avant);
});

it('plafonne les montants de l\'avenant à 100 milliards d\'unités mineures : 422 avant toute écriture', function (): void {
    $avant = ($this->etat)();

    foreach (['fee_flat_amount', 'fee_minimum_amount', 'works_limit_amount'] as $champ) {
        ($this->avenant)([$champ => 100_000_000_001])->assertUnprocessable()->assertJsonValidationErrors($champ);
        ($this->avenant)([$champ => 9_000_000_000_000_000_000])->assertUnprocessable()->assertJsonValidationErrors($champ);
    }

    expect(($this->etat)())->toBe($avant);
});
