<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Events\InspectionPublished;
use App\Modules\Inspections\Events\InspectionRemarkAnswered;
use App\Modules\Inspections\Events\InspectionRemarkReceived;
use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Models\InspectionRemark;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Actions\AnonymizeParty;
use App\Modules\Parties\Models\Party;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
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
    $this->equipe = fn (string $chemin, string $methode = 'getJson', array $corps = [], $compte = null) => R::changerDeCompte($this, $compte ?? $this->w['manager'])
        ->{$methode}("/api/v1/org/{$this->org->id}{$chemin}", ...($methode === 'getJson' ? [] : [$corps]));
    $this->enregistrer = fn (array $corps = [], ?string $bail = null, $compte = null) => R::changerDeCompte($this, $compte ?? $this->w['manager'])
        ->post("/api/v1/org/{$this->org->id}/leases/".($bail ?? $this->lease->id).'/inspections', [
            'file' => W::pdf('etat-des-lieux.pdf'),
            'kind' => 'entry',
            'performed_on' => '2026-11-10',
            'performed_by' => 'agent',
            'signatories' => [['name' => 'Agent Immo', 'capacity' => 'Mandataire', 'date' => '2026-11-10'], ['name' => 'Locataire Test', 'capacity' => 'Locataire', 'date' => '2026-11-10']],
            'client_id' => (string) Str::uuid7(),
            ...$corps,
        ], ['Accept' => 'application/json']);
    $this->publie = function (array $corps = [], ?string $bail = null): string {
        $id = ($this->enregistrer)($corps, $bail)->assertCreated()->json('data.id');
        ($this->equipe)("/inspections/{$id}/publish", 'postJson')->assertOk();

        return $id;
    };
    $this->remarquer = fn (string $inspection, array $corps = [], $compte = null) => T::comme($this, $compte ?? $this->moi['user'])
        ->post("/api/v1/tenant/inspections/{$inspection}/remarks", ['kind' => 'complement', 'body' => 'Une tache au plafond du salon.', 'client_id' => (string) Str::uuid7(), ...$corps], ['Accept' => 'application/json']);
    $this->coloc = function () {
        $partie = T::colocataire($this->org, $this->lease);
        $compte = User::factory()->create();
        L::dans($this->org, fn () => $partie->forceFill(['user_id' => $compte->id])->save());

        return $compte;
    };
});

it('enregistre un état des lieux invisible du locataire jusqu\'à sa publication', function (): void {
    $cree = ($this->enregistrer)()->assertCreated();
    $id = $cree->json('data.id');

    expect(array_keys($cree->json('data')))->toBe(['id', 'lease_id', 'kind', 'performed_on', 'performed_by', 'signatories', 'exit_matches_entry', 'stored_file_id', 'published_at', 'published_by_user_id', 'created_by_user_id', 'lock_version', 'created_at'])
        ->and($cree->json('data'))->toMatchArray(['kind' => 'entry', 'performed_on' => '2026-11-10', 'published_at' => null, 'lock_version' => 1])
        ->and(DB::table('inspections')->value('signatories'))->not->toContain('Locataire Test')
        ->and(W::actions())->toContain('inspections.inspection.recorded')
        ->and(DB::table('stored_files')->where('id', $cree->json('data.stored_file_id'))->value('subject_type'))->toBe('tenant_space');

    expect(T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/inspections')->assertOk()->json('data'))->toBe([]);
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/inspections/{$id}")->assertNotFound()->assertJsonPath('code', 'inspection_not_found');
    expect(($this->equipe)("/inspections/{$id}/document")->assertOk()->streamedContent())->toBe(W::PDF);
    expect(($this->equipe)("/leases/{$this->lease->id}/inspections")->assertOk()->json('data.0.id'))->toBe($id);
});

it('rejoue un enregistrement identique et refuse un contenu différent sous la même clé', function (): void {
    $cle = (string) Str::uuid7();
    $id = ($this->enregistrer)(['client_id' => $cle])->assertCreated()->json('data.id');

    ($this->enregistrer)(['client_id' => $cle])->assertOk()->assertJsonPath('data.id', $id);
    ($this->enregistrer)(['client_id' => $cle, 'performed_on' => '2026-11-11'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    expect(DB::table('inspections')->count())->toBe(1);
});

it('refuse un fichier qui n\'est pas un PDF, une date future, une conformité sur un état d\'entrée et un bail inconnu', function (): void {
    ($this->enregistrer)(['file' => UploadedFile::fake()->image('plan.png')])->assertUnprocessable();
    ($this->enregistrer)(['performed_on' => '2026-11-17'])->assertUnprocessable();
    ($this->enregistrer)(['exit_matches_entry' => '1'])->assertUnprocessable();
    ($this->enregistrer)(['kind' => 'autre'])->assertUnprocessable();
    ($this->enregistrer)([], (string) Str::uuid7())->assertNotFound()->assertJsonPath('code', 'lease_not_found');

    expect(DB::table('inspections')->count())->toBe(0);
});

it('publie : un état de sortie exige la conformité, la publication se rejoue sans second événement, un état publié est figé', function (): void {
    Event::fake([InspectionPublished::class]);
    $id = ($this->enregistrer)(['kind' => 'exit', 'performed_on' => '2026-11-15'])->assertCreated()->json('data.id');

    ($this->equipe)("/inspections/{$id}/publish", 'postJson')->assertConflict()->assertJsonPath('code', 'inspection_not_publishable');
    ($this->equipe)("/inspections/{$id}", 'patchJson', ['lock_version' => 9, 'exit_matches_entry' => true])->assertConflict()->assertJsonPath('code', 'inspection_stale_version');
    ($this->equipe)("/inspections/{$id}", 'patchJson', ['lock_version' => 1, 'exit_matches_entry' => true, 'performed_by' => 'bailiff'])->assertOk()->assertJsonPath('data.lock_version', 2)->assertJsonPath('data.performed_by', 'bailiff');

    ($this->equipe)("/inspections/{$id}/publish", 'postJson')->assertOk()->assertJsonPath('data.published_by_user_id', $this->w['manager']->id);
    ($this->equipe)("/inspections/{$id}/publish", 'postJson')->assertOk();
    ($this->equipe)("/inspections/{$id}", 'patchJson', ['lock_version' => 3, 'performed_by' => 'agent'])->assertConflict()->assertJsonPath('code', 'inspection_published');

    Event::assertDispatchedTimes(InspectionPublished::class, 1);
    expect(W::actions())->toContain('inspections.inspection.published');

    $entreeId = ($this->enregistrer)()->assertCreated()->json('data.id');
    ($this->equipe)("/inspections/{$entreeId}", 'patchJson', ['lock_version' => 1, 'exit_matches_entry' => true])->assertUnprocessable();
});

it('montre au locataire l\'état publié de ses baux : forme, PDF, fenêtres de remarque encore ouvertes', function (): void {
    $id = ($this->publie)();

    $liste = T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/inspections')->assertOk();
    $vue = T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/inspections/{$id}")->assertOk()->json('data');

    expect($liste->json('data.0'))->toBe($vue)
        ->and(array_keys($vue))->toBe(['id', 'lease_id', 'kind', 'performed_on', 'performed_by', 'signatories', 'exit_matches_entry', 'open_remark_kinds', 'published_at'])
        ->and($vue['open_remark_kinds'])->toBe(['complement', 'heating'])
        ->and($vue['signatories'][1])->toBe(['name' => 'Locataire Test', 'capacity' => 'Locataire', 'date' => '2026-11-10'])
        ->and(T::comme($this, $this->moi['user'])->get("/api/v1/tenant/inspections/{$id}/document")->assertOk()->headers->get('Cache-Control'))->toContain('no-store');

    $this->travel(11)->days();
    expect(T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/inspections/{$id}")->json('data.open_remark_kinds'))->toBe(['heating']);
});

it('cloisonne par bail et par organisation : 404 pour un autre locataire, un autre bail ou une autre agence', function (): void {
    $id = ($this->publie)();
    $voisin = T::locataire($this->org);
    $autre = T::locataire(T::organisation('Immo Loire'));
    $remarqueId = ($this->remarquer)($id)->assertCreated()->json('data.id');

    foreach ([$voisin['user'], $autre['user']] as $intrus) {
        T::comme($this, $intrus)->getJson("/api/v1/tenant/inspections/{$id}")->assertNotFound()->assertJsonPath('code', 'inspection_not_found');
        T::comme($this, $intrus)->get("/api/v1/tenant/inspections/{$id}/document")->assertNotFound();
        T::comme($this, $intrus)->getJson("/api/v1/tenant/inspections/{$id}/remarks")->assertNotFound();
        ($this->remarquer)($id, [], $intrus)->assertNotFound();
        expect(T::comme($this, $intrus)->getJson('/api/v1/tenant/inspections')->assertOk()->json('data'))->toBe([]);
    }

    expect($remarqueId)->not->toBeEmpty();
});

it('enregistre une remarque avec photos : trace en ajout seul, confidentielle entre colocataires', function (): void {
    Event::fake([InspectionRemarkReceived::class]);
    $id = ($this->publie)();
    $coloc = ($this->coloc)();

    $cree = ($this->remarquer)($id, ['photos' => [UploadedFile::fake()->image('mur.jpg', 60, 40), UploadedFile::fake()->image('sol.png', 60, 40)]])->assertCreated();
    $remarque = $cree->json('data');

    expect(DB::table('stored_files')->where('subject_type', 'tenant_space')->count())->toBe(3)
        ->and(array_keys($remarque))->toBe(['id', 'inspection_id', 'kind', 'body', 'status', 'answer', 'photos', 'created_at'])
        ->and($remarque)->toMatchArray(['kind' => 'complement', 'status' => 'open', 'answer' => null, 'body' => 'Une tache au plafond du salon.'])
        ->and(array_column($remarque['photos'], 'position'))->toBe([1, 2])
        ->and(DB::table('inspection_remarks')->value('body'))->not->toContain('tache')
        ->and(W::actions())->toContain('inspections.remark.created')
        ->and((string) DB::table('audit_logs')->pluck('metadata')->implode(''))->not->toContain('tache');
    Event::assertDispatched(InspectionRemarkReceived::class);

    expect(T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/inspections/{$id}/remarks")->assertOk()->json('data.0.id'))->toBe($remarque['id'])
        ->and(T::comme($this, $coloc)->getJson("/api/v1/tenant/inspections/{$id}/remarks")->assertOk()->json('data'))->toBe([]);

    $photo = $remarque['photos'][0]['id'];
    T::comme($this, $this->moi['user'])->get("/api/v1/tenant/inspection-files/{$photo}")->assertOk();
    T::comme($this, $coloc)->get("/api/v1/tenant/inspection-files/{$photo}")->assertNotFound();
    expect(($this->equipe)("/inspection-remark-files/{$photo}")->assertOk()->headers->get('Content-Type'))->toContain('image');

    expect(fn () => DB::table('inspection_remarks')->update(['kind' => 'comment']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('inspection_remarks')->delete())->toThrow(QueryException::class)
        ->and(fn () => DB::table('inspection_remark_files')->update(['position' => 9]))->toThrow(QueryException::class);
});

it('rejoue une remarque identique, refuse un contenu différent, au-delà de six photos ou hors image', function (): void {
    $id = ($this->publie)();
    $cle = (string) Str::uuid7();
    $remarque = ($this->remarquer)($id, ['client_id' => $cle])->assertCreated()->json('data.id');

    ($this->remarquer)($id, ['client_id' => $cle])->assertOk()->assertJsonPath('data.id', $remarque);
    ($this->remarquer)($id, ['client_id' => $cle, 'body' => 'Autre texte différent'])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    ($this->remarquer)($id, ['photos' => array_map(fn (int $i) => UploadedFile::fake()->image("p{$i}.jpg"), range(1, 7))])->assertUnprocessable();
    ($this->remarquer)($id, ['photos' => [W::pdf()]])->assertUnprocessable();
    ($this->remarquer)($id, ['body' => 'x'])->assertUnprocessable();
    ($this->remarquer)($id, ['kind' => 'inconnu'])->assertUnprocessable();

    expect(DB::table('inspection_remarks')->count())->toBe(1);
});

it('applique les fenêtres : complément 10 jours, chauffage 13 mois, commentaire sur la sortie, jamais pendant la grâce pour l\'entrée', function (): void {
    $entree = ($this->publie)(['performed_on' => '2026-11-06']);
    $sortie = ($this->publie)(['kind' => 'exit', 'performed_on' => '2026-11-10', 'exit_matches_entry' => '1']);

    ($this->remarquer)($entree, ['kind' => 'complement'])->assertCreated();
    ($this->remarquer)($entree, ['kind' => 'heating'])->assertCreated();
    ($this->remarquer)($entree, ['kind' => 'comment'])->assertConflict()->assertJsonPath('code', 'inspection_remark_window_closed');
    ($this->remarquer)($sortie, ['kind' => 'complement'])->assertConflict()->assertJsonPath('code', 'inspection_remark_window_closed');
    ($this->remarquer)($sortie, ['kind' => 'heating'])->assertConflict()->assertJsonPath('code', 'inspection_remark_window_closed');
    ($this->remarquer)($sortie, ['kind' => 'comment'])->assertCreated();

    $this->travelTo('2026-11-17 10:00:00');
    ($this->remarquer)($entree, ['kind' => 'complement'])->assertConflict()->assertJsonPath('code', 'inspection_remark_window_closed');
    ($this->remarquer)($entree, ['kind' => 'heating'])->assertCreated();

    $this->travelTo('2027-02-01 10:00:00');
    ($this->remarquer)($entree, ['kind' => 'heating'])->assertConflict()->assertJsonPath('code', 'inspection_remark_window_closed');
});

it('laisse commenter la sortie en période de grâce mais plus rien sur l\'entrée', function (): void {
    $ancien = T::locataire($this->org, ['starts_on' => '2025-06-01', 'ends_on' => '2026-10-31'], [], $this->moi['user']);
    $entree = ($this->publie)(['performed_on' => '2026-11-12'], $ancien['lease']->id);
    $sortie = ($this->publie)(['kind' => 'exit', 'performed_on' => '2026-11-01', 'exit_matches_entry' => '0'], $ancien['lease']->id);

    ($this->remarquer)($sortie, ['kind' => 'comment'])->assertCreated();
    ($this->remarquer)($entree, ['kind' => 'complement'])->assertConflict()->assertJsonPath('code', 'inspection_remark_window_closed');
    ($this->remarquer)($entree, ['kind' => 'heating'])->assertConflict()->assertJsonPath('code', 'inspection_remark_window_closed');
    expect(T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/inspections/{$sortie}")->json('data.open_remark_kinds'))->toBe(['comment']);
});

it('laisse l\'équipe répondre une fois à une remarque, sans toucher à l\'état des lieux', function (): void {
    Event::fake([InspectionRemarkAnswered::class]);
    $id = ($this->publie)();
    $remarque = ($this->remarquer)($id)->assertCreated()->json('data.id');
    $corps = ['answer' => 'accepted', 'body' => 'Le complément est ajouté à l\'état des lieux.'];

    ($this->equipe)("/inspection-remarks/{$remarque}/answer", 'postJson', $corps, $this->w['accountant'])->assertForbidden();
    ($this->equipe)("/inspection-remarks/{$remarque}/answer", 'postJson', ['answer' => 'autre', 'body' => 'Texte'])->assertUnprocessable();
    ($this->equipe)("/inspection-remarks/{$remarque}/answer", 'postJson', $corps)->assertOk()->assertJsonPath('data.status', 'answered')->assertJsonPath('data.answer', 'accepted')->assertJsonPath('data.answered_by_user_id', $this->w['manager']->id);
    ($this->equipe)("/inspection-remarks/{$remarque}/answer", 'postJson', $corps)->assertConflict()->assertJsonPath('code', 'inspection_remark_answered');
    ($this->equipe)('/inspection-remarks/'.Str::uuid7().'/answer', 'postJson', $corps)->assertNotFound()->assertJsonPath('code', 'inspection_remark_not_found');
    Event::assertDispatchedTimes(InspectionRemarkAnswered::class, 1);

    $vue = T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/inspections/{$id}/remarks")->json('data.0');
    expect($vue['status'])->toBe('answered')->and($vue['answer']['decision'])->toBe('accepted')->and($vue['answer']['body'])->toBe($corps['body'])
        ->and(W::actions())->toContain('inspections.remark.answered')
        ->and((string) DB::table('audit_logs')->pluck('metadata')->implode(''))->not->toContain('complément')
        ->and(L::dans($this->org, fn () => Inspection::query()->findOrFail($id)->lock_version))->toBe(2);
    expect(($this->equipe)("/inspections/{$id}/remarks")->assertOk()->json('data.0.party_id'))->toBe($this->moi['party']->id);
});

it('exige un compte locataire vérifié et refuse les jetons opérateur, sans jeton 401', function (): void {
    $id = ($this->publie)();
    auth()->forgetGuards();
    $this->flushSession();

    $this->getJson('/api/v1/tenant/inspections')->assertUnauthorized();
    $this->getJson("/api/v1/tenant/inspections/{$id}")->assertUnauthorized();
    $this->postJson("/api/v1/tenant/inspections/{$id}/remarks", [])->assertUnauthorized();
    $this->getJson("/api/v1/tenant/inspection-files/{$id}")->assertUnauthorized();
    T::comme($this, User::factory()->create())->getJson("/api/v1/tenant/inspections/{$id}")->assertForbidden();
    T::comme($this, User::factory()->unverified()->create())->getJson('/api/v1/tenant/inspections')->assertForbidden();
});

it('limite les remarques à dix par jour', function (): void {
    $id = ($this->publie)();

    Cache::flush();

    foreach (range(1, 10) as $i) {
        ($this->remarquer)($id, ['body' => "Remarque numéro {$i}"])->assertCreated();
    }

    ($this->remarquer)($id, ['body' => 'Trop de remarques'])->assertStatus(429);
});

it('lit un nombre constant de requêtes quel que soit le nombre d\'états publiés', function (): void {
    ($this->publie)(['performed_on' => '2026-11-10']);
    $un = W::requetes(fn () => T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/inspections')->assertOk());

    foreach (range(1, 9) as $i) {
        ($this->publie)(['performed_on' => '2026-11-10']);
    }
    $dix = W::requetes(fn () => T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/inspections')->assertOk());

    expect($dix)->toBe($un);
});

it('ferme la gestion aux comptables et aux autres agences, lecture comprise, et exige le jeton', function (): void {
    $id = ($this->publie)();
    $remarque = ($this->remarquer)($id)->assertCreated()->json('data.id');
    $etranger = R::bailSigne(L::organisation(), ['reference' => 'BL-2026-0099']);
    $titulaireAutre = L::titulaire(T::organisation('Immo Loire'));

    foreach (["/leases/{$this->lease->id}/inspections", "/inspections/{$id}", "/inspections/{$id}/remarks", "/inspections/{$id}/document"] as $chemin) {
        ($this->equipe)($chemin, 'getJson', [], $this->w['accountant'])->assertForbidden()->assertJsonPath('code', 'role_forbidden');
        ($this->equipe)($chemin, 'getJson', [], $titulaireAutre)->assertNotFound();
    }
    ($this->equipe)("/inspections/{$id}/publish", 'postJson', [], $this->w['accountant'])->assertForbidden();
    ($this->equipe)("/inspections/{$id}", 'patchJson', ['lock_version' => 1], $this->w['accountant'])->assertForbidden();
    ($this->enregistrer)([], null, $this->w['accountant'])->assertForbidden();
    ($this->equipe)("/inspection-remarks/{$remarque}/answer", 'postJson', ['answer' => 'noted', 'body' => 'Pris en compte'], $titulaireAutre)->assertNotFound();
    ($this->enregistrer)([], $etranger->id)->assertNotFound()->assertJsonPath('code', 'lease_not_found');

    auth()->forgetGuards();
    $this->getJson("/api/v1/org/{$this->org->id}/inspections/{$id}")->assertUnauthorized();
    $this->postJson("/api/v1/org/{$this->org->id}/inspections/{$id}/publish")->assertUnauthorized();
    expect($this->w['accountant']->id)->not->toBeEmpty()->and(MemberRole::Accountant->value)->toBe('accountant');
});

it('efface les textes d\'une fiche anonymisée, garde la décision de l\'équipe, ne touche pas le colocataire et se rejoue sans effet', function (): void {
    $id = ($this->publie)();
    $coloc = ($this->coloc)();
    $remarque = ($this->remarquer)($id, ['body' => 'Mon arrêt maladie explique la tache.'])->assertCreated()->json('data.id');
    ($this->remarquer)($id, ['body' => 'Le robinet fuit chez Mme Durand.', 'kind' => 'heating'], $coloc)->assertCreated();
    ($this->equipe)("/inspection-remarks/{$remarque}/answer", 'postJson', ['answer' => 'accepted', 'body' => 'Merci Awa pour votre remarque.'])->assertOk();

    $anonymiser = fn () => L::dans($this->org, fn () => app(AnonymizeParty::class)->handle(Party::query()->findOrFail($this->moi['party']->id), 'requested'));
    $anonymiser();

    $lignes = L::dans($this->org, fn () => InspectionRemark::query()->orderBy('created_at')->get());
    expect($lignes)->toHaveCount(2)
        ->and($lignes[0]->body)->toBe('[effacé]')->and($lignes[0]->answer_body)->toBe('[effacé]')
        ->and($lignes[0]->status->value)->toBe('answered')->and($lignes[0]->answer->value)->toBe('accepted')
        ->and($lignes[1]->body)->toBe('Le robinet fuit chez Mme Durand.')
        ->and(W::actions())->toContain('inspections.remarks.erased')
        ->and((string) json_encode(DB::table('audit_logs')->pluck('metadata')->all(), JSON_UNESCAPED_UNICODE))->not->toContain('arrêt maladie');

    $avant = DB::table('audit_logs')->where('action', 'inspections.remarks.erased')->count();
    $anonymiser();

    expect(DB::table('audit_logs')->where('action', 'inspections.remarks.erased')->count())->toBe($avant);
});
