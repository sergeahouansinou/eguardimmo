<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Events\LeaseInsuranceDecided;
use App\Modules\Leases\Events\LeaseInsuranceReminded;
use App\Modules\Leases\Events\LeaseInsuranceSubmitted;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantWriteContext as W;

beforeEach(function (): void {
    $this->w = W::monde($this);
    $this->org = $this->w['org'];
    $this->moi = $this->w['moi'];
    $this->lease = $this->moi['lease'];
    $this->base = "/api/v1/tenant/leases/{$this->lease->id}";
    $this->deposer = fn (array $corps = [], $compte = null, ?string $bail = null) => T::comme($this, $compte ?? $this->moi['user'])
        ->post('/api/v1/tenant/leases/'.($bail ?? $this->lease->id).'/insurance-submissions', [
            'file' => W::pdf(),
            'insurer' => 'Assureur Soleil',
            'policy_number' => 'POL-778899',
            'starts_on' => '2026-11-01',
            'ends_on' => '2027-11-01',
            'client_id' => (string) Str::uuid7(),
            ...$corps,
        ], ['Accept' => 'application/json']);
    $this->equipe = fn (string $chemin, string $methode = 'getJson', array $corps = [], $compte = null) => R::changerDeCompte($this, $compte ?? $this->w['manager'])
        ->{$methode}("/api/v1/org/{$this->org->id}{$chemin}", ...($methode === 'getJson' ? [] : [$corps]));
    $this->couverture = fn () => T::comme($this, $this->moi['user'])->getJson("{$this->base}/insurance")->assertOk()->json('data.coverage');
    $this->colocataire = function () {
        $partie = T::colocataire($this->org, $this->lease);
        $compte = User::factory()->create();
        L::dans($this->org, fn () => $partie->forceFill(['user_id' => $compte->id])->save());

        return $compte;
    };
});

it('dépose une attestation puis la voit acceptée : la pièce du bail n\'existe qu\'après acceptation', function (): void {
    Event::fake([LeaseInsuranceSubmitted::class, LeaseInsuranceDecided::class]);
    expect(($this->couverture)())->toBe(['state' => 'missing', 'ends_on' => null]);

    $cree = ($this->deposer)()->assertCreated()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.ends_on', '2027-11-01');
    $id = $cree->json('data.id');
    expect(array_keys($cree->json('data')))->toBe(['id', 'status', 'insurer', 'policy_number', 'starts_on', 'ends_on', 'rejection_reason', 'note', 'created_at', 'decided_at'])
        ->and(($this->couverture)()['state'])->toBe('missing')
        ->and(DB::table('certificates')->count())->toBe(0);
    Event::assertDispatched(LeaseInsuranceSubmitted::class, fn ($e): bool => $e->submissionId === $id && $e->leaseId === $this->lease->id);

    $liste = ($this->equipe)('/insurance-submissions?status=pending')->assertOk();
    expect($liste->json('data.0'))->toMatchArray(['id' => $id, 'insurer' => 'Assureur Soleil', 'policy_number' => 'POL-778899', 'status' => 'pending', 'party_id' => $this->moi['party']->id]);

    ($this->equipe)("/insurance-submissions/{$id}/accept", 'postJson')->assertOk()->assertJsonPath('data.status', 'accepted')->assertJsonPath('data.decided_by_user_id', $this->w['manager']->id);

    $piece = DB::table('certificates')->first();
    expect($piece->subject_type)->toBe('lease')->and($piece->subject_id)->toBe($this->lease->id)->and(substr((string) $piece->expires_on, 0, 10))->toBe('2027-11-01')
        ->and(DB::table('lease_insurance_submissions')->value('certificate_id'))->toBe($piece->id)
        ->and(($this->couverture)())->toBe(['state' => 'valid', 'ends_on' => '2027-11-01']);
    Event::assertDispatched(LeaseInsuranceDecided::class, fn ($e): bool => $e->accepted && $e->partyId === $this->moi['party']->id);

    T::comme($this, $this->moi['user'])->getJson("{$this->base}/insurance")->assertJsonPath('data.submissions.0.status', 'accepted');
    expect(W::actions())->toContain('leases.insurance.submitted', 'leases.insurance.accepted');
});

it('annonce une couverture à renouveler à l\'approche de l\'échéance', function (): void {
    ($this->deposer)(['ends_on' => '2026-12-01'])->assertCreated();
    ($this->equipe)('/insurance-submissions/'.DB::table('lease_insurance_submissions')->value('id').'/accept', 'postJson')->assertOk();

    expect(($this->couverture)())->toBe(['state' => 'expiring', 'ends_on' => '2026-12-01']);
});

it('refuse un dépôt sans jamais créer de pièce et explique le motif au locataire', function (): void {
    Event::fake([LeaseInsuranceDecided::class]);
    $id = ($this->deposer)()->assertCreated()->json('data.id');

    ($this->equipe)("/insurance-submissions/{$id}/reject", 'postJson', ['reason' => 'wrong_address', 'note' => 'Adresse du logement différente.'])
        ->assertOk()->assertJsonPath('data.status', 'rejected')->assertJsonPath('data.rejection_reason', 'wrong_address');

    expect(DB::table('certificates')->count())->toBe(0)->and(($this->couverture)()['state'])->toBe('missing');
    $vue = T::comme($this, $this->moi['user'])->getJson("{$this->base}/insurance")->assertOk()->json('data.submissions.0');
    expect($vue)->toMatchArray(['status' => 'rejected', 'rejection_reason' => 'wrong_address', 'note' => 'Adresse du logement différente.']);
    Event::assertDispatched(LeaseInsuranceDecided::class, fn ($e): bool => ! $e->accepted);
    expect(DB::table('lease_insurance_submissions')->value('insurer'))->not->toContain('Soleil')
        ->and(DB::table('lease_insurance_submissions')->value('policy_number'))->not->toContain('778899')
        ->and((string) AuditLog::query()->pluck('metadata')->implode(''))->not->toContain('Soleil')->not->toContain('778899')->not->toContain('Adresse du logement');

    ($this->equipe)("/insurance-submissions/{$id}/reject", 'postJson', ['reason' => 'other'])->assertConflict()->assertJsonPath('code', 'insurance_submission_not_pending');
    ($this->equipe)("/insurance-submissions/{$id}/accept", 'postJson')->assertConflict()->assertJsonPath('code', 'insurance_submission_not_pending');
    ($this->equipe)("/insurance-submissions/{$id}/reject", 'postJson', ['reason' => 'inconnu'])->assertUnprocessable();
    ($this->equipe)("/insurance-submissions/{$id}/reject", 'postJson', ['reason' => 'other', 'note' => str_repeat('a', 501)])->assertUnprocessable();
});

it('rejoue un dépôt identique, refuse un contenu différent et un second dépôt en attente', function (): void {
    $cle = (string) Str::uuid7();
    $premier = ($this->deposer)(['client_id' => $cle])->assertCreated()->json('data.id');
    ($this->deposer)(['client_id' => $cle])->assertOk()->assertJsonPath('data.id', $premier);
    ($this->deposer)(['client_id' => $cle, 'policy_number' => 'AUTRE-1'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    ($this->deposer)()->assertConflict()->assertJsonPath('code', 'insurance_submission_not_allowed');

    T::comme($this, $this->moi['user'])->deleteJson("/api/v1/tenant/insurance-submissions/{$premier}")->assertOk()->assertJsonPath('data.status', 'withdrawn');
    T::comme($this, $this->moi['user'])->deleteJson("/api/v1/tenant/insurance-submissions/{$premier}")->assertConflict()->assertJsonPath('code', 'insurance_submission_not_pending');
    ($this->deposer)()->assertCreated();

    expect(LeaseInsuranceSubmission::query()->withoutGlobalScopes()->count())->toBe(2)->and(DB::table('certificates')->count())->toBe(0)
        ->and(W::actions())->toContain('leases.insurance.withdrawn');
});

it('valide la période, le fichier et les champs', function (): void {
    ($this->deposer)(['ends_on' => '2026-11-01'])->assertUnprocessable()->assertJsonPath('code', 'insurance_period_invalid');
    ($this->deposer)(['starts_on' => '2026-01-01', 'ends_on' => '2026-11-15'])->assertUnprocessable()->assertJsonPath('code', 'insurance_period_invalid');
    ($this->deposer)(['insurer' => ''])->assertUnprocessable();
    ($this->deposer)(['starts_on' => '01/11/2026'])->assertUnprocessable();
    ($this->deposer)(['client_id' => 'x'])->assertUnprocessable();
    $this->travel(61)->minutes();
    ($this->deposer)(['file' => UploadedFile::fake()->createWithContent('malin.pdf', '<?php echo 1;')])->assertStatus(422);
    ($this->deposer)(['file' => UploadedFile::fake()->createWithContent('trop-gros.pdf', W::PDF.str_repeat('a', 11 * 1024 * 1024))])->assertUnprocessable();

    expect(DB::table('lease_insurance_submissions')->count())->toBe(0);
});

it('lit pendant la grâce mais refuse un dépôt sur un bail terminé', function (): void {
    $fini = T::locataire($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2025-11-17'], [], $this->moi['user']);

    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$fini['lease']->id}/insurance")->assertOk();
    ($this->deposer)([], null, $fini['lease']->id)->assertConflict()->assertJsonPath('code', 'insurance_submission_not_allowed');
});

it('télécharge son attestation, journalisé, sans exposer l\'identifiant du fichier', function (): void {
    $cree = ($this->deposer)()->assertCreated();
    $id = $cree->json('data.id');

    expect((string) $cree->getContent())->not->toContain('stored_file_id')->not->toContain($this->moi['party']->id);
    $reponse = T::comme($this, $this->moi['user'])->get("/api/v1/tenant/insurance-submissions/{$id}/download")->assertOk();
    expect($reponse->streamedContent())->toBe(W::PDF)->and($reponse->headers->get('Cache-Control'))->toContain('no-store')
        ->and(AuditLog::query()->where('action', 'documents.file.downloaded')->count())->toBe(1);
});

it('cloisonne les colocataires : couverture partagée, dépôts jamais', function (): void {
    $voisin = ($this->colocataire)();
    $id = ($this->deposer)()->assertCreated()->json('data.id');
    ($this->equipe)("/insurance-submissions/{$id}/accept", 'postJson')->assertOk();

    expect(T::comme($this, $voisin)->getJson("{$this->base}/insurance")->assertOk()->json('data'))->toBe(['coverage' => ['state' => 'valid', 'ends_on' => '2027-11-01'], 'submissions' => []]);
    T::comme($this, $voisin)->get("/api/v1/tenant/insurance-submissions/{$id}/download")->assertNotFound()->assertJsonPath('code', 'insurance_submission_not_found');
    T::comme($this, $voisin)->deleteJson("/api/v1/tenant/insurance-submissions/{$id}")->assertNotFound()->assertJsonPath('code', 'insurance_submission_not_found');
    expect(($this->deposer)([], $voisin)->assertCreated()->json('data.id'))->not->toBe($id);
    expect(T::comme($this, $this->moi['user'])->getJson("{$this->base}/insurance")->json('data.submissions'))->toHaveCount(1);
});

it('répond 404 pour un autre bail, une autre organisation ou un identifiant inconnu et refuse les non-locataires', function (): void {
    $id = ($this->deposer)()->assertCreated()->json('data.id');
    $voisin = T::locataire($this->org);
    $autre = T::locataire(T::organisation('Immo Loire'));

    foreach ([$voisin['lease']->id, $autre['lease']->id, (string) Str::uuid7()] as $bail) {
        T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$bail}/insurance")->assertNotFound()->assertJsonPath('code', 'lease_not_found');
        ($this->deposer)([], null, $bail)->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    }
    T::comme($this, $voisin['user'])->get("/api/v1/tenant/insurance-submissions/{$id}/download")->assertNotFound();
    T::comme($this, $autre['user'])->deleteJson("/api/v1/tenant/insurance-submissions/{$id}")->assertNotFound();
    T::comme($this, $this->moi['user'])->deleteJson('/api/v1/tenant/insurance-submissions/'.Str::uuid7())->assertNotFound();

    T::comme($this, User::factory()->create())->getJson("{$this->base}/insurance")->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    ($this->deposer)([], User::factory()->create())->assertForbidden();
    T::comme($this, null)->getJson("{$this->base}/insurance")->assertUnauthorized();
    T::comme($this, null)->postJson("{$this->base}/insurance-submissions", [])->assertUnauthorized();
    T::comme($this, null)->deleteJson("/api/v1/tenant/insurance-submissions/{$id}")->assertUnauthorized();
});

it('limite les dépôts à cinq par heure', function (): void {
    foreach (range(1, 5) as $_) {
        ($this->deposer)()->assertCreated();
        $id = DB::table('lease_insurance_submissions')->orderByDesc('id')->value('id');
        T::comme($this, $this->moi['user'])->deleteJson("/api/v1/tenant/insurance-submissions/{$id}")->assertOk();
    }
    ($this->deposer)()->assertStatus(429);
});

it('réserve les décisions aux rôles de gestion et cloisonne les organisations', function (): void {
    $id = ($this->deposer)()->assertCreated()->json('data.id');
    $intrus = L::titulaire(T::organisation('Immo Loire'));

    foreach ([['/insurance-submissions', 'getJson'], ["/insurance-submissions/{$id}/accept", 'postJson'], ["/insurance-submissions/{$id}/reject", 'postJson'], ["/leases/{$this->lease->id}/insurance", 'getJson'], ["/leases/{$this->lease->id}/insurance/reminder", 'postJson']] as [$chemin, $methode]) {
        ($this->equipe)($chemin, $methode, ['reason' => 'other'], $this->w['accountant'])->assertForbidden();
    }
    ($this->equipe)("/insurance-submissions/{$id}/accept", 'postJson', [], $intrus)->assertStatus(404);
    ($this->equipe)("/leases/{$this->lease->id}/insurance", 'getJson', [], $intrus)->assertStatus(404);
    expect(($this->equipe)('/insurance-submissions', 'getJson', [], $intrus)->assertStatus(404))->not->toBeNull();

    auth()->forgetGuards();
    $this->getJson("/api/v1/org/{$this->org->id}/insurance-submissions")->assertUnauthorized();
    ($this->equipe)('/insurance-submissions/'.Str::uuid7().'/accept', 'postJson')->assertNotFound()->assertJsonPath('code', 'insurance_submission_not_found');
    expect(DB::table('lease_insurance_submissions')->value('status'))->toBe('pending');
});

it('refuse d\'accepter une attestation déjà échue', function (): void {
    $id = ($this->deposer)()->assertCreated()->json('data.id');
    $this->travelTo(now()->addYears(2));

    ($this->equipe)("/insurance-submissions/{$id}/accept", 'postJson')->assertUnprocessable()->assertJsonPath('code', 'insurance_period_invalid');
    expect(DB::table('certificates')->count())->toBe(0);
});

it('relance les locataires au plus une fois tous les sept jours et par bail', function (): void {
    Event::fake([LeaseInsuranceReminded::class]);
    $autre = T::locataire($this->org);
    $relancer = fn (string $bail) => ($this->equipe)("/leases/{$bail}/insurance/reminder", 'postJson');

    $relancer($this->lease->id)->assertStatus(202);
    $relancer($this->lease->id)->assertStatus(429)->assertJsonPath('code', 'insurance_reminder_too_soon');
    $relancer($autre['lease']->id)->assertStatus(202);
    $this->travel(6)->days();
    $relancer($this->lease->id)->assertStatus(429);
    $this->travel(2)->days();
    $relancer($this->lease->id)->assertStatus(202);

    Event::assertDispatchedTimes(LeaseInsuranceReminded::class, 3);
    expect(W::actions())->toContain('leases.insurance.reminded');
});

it('refuse la relance d\'un bail brouillon', function (): void {
    $brouillon = L::dans($this->org, fn () => L::bail($this->org));

    ($this->equipe)("/leases/{$brouillon->id}/insurance/reminder", 'postJson')->assertConflict()->assertJsonPath('code', 'insurance_submission_not_allowed');
});

it('réserve le fichier déposé à la route dédiée : 404 en générique, 200 pour la gestion avec journal, 403 au comptable', function (): void {
    $id = ($this->deposer)()->assertCreated()->json('data.id');
    $fichier = DB::table('lease_insurance_submissions')->where('id', $id)->value('stored_file_id');

    expect(DB::table('stored_files')->where('id', $fichier)->value('subject_type'))->toBe('tenant_space');

    foreach (['manager', 'accountant', 'owner'] as $role) {
        ($this->equipe)('/documents/files/'.$fichier.'/download', 'getJson', [], $this->w[$role])->assertNotFound();
    }

    $reponse = ($this->equipe)("/insurance-submissions/{$id}/download")->assertOk();
    expect($reponse->headers->get('Content-Disposition'))->toContain('attachment')
        ->and(W::actions())->toContain('leases.insurance.downloaded');

    ($this->equipe)("/insurance-submissions/{$id}/download", 'getJson', [], $this->w['accountant'])->assertForbidden();
    ($this->equipe)('/insurance-submissions/'.Str::uuid7().'/download')->assertNotFound();
    ($this->equipe)("/insurance-submissions/{$id}/download", 'getJson', [], L::titulaire(T::organisation('Immo Loire')))->assertNotFound();
});
