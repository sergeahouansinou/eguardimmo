<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Models\Intervention;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence(50000);
    $this->org = $this->scene['org'];
    $this->awa = X::rattacher($this->org, $this->scene['mandant']);
    $this->partager = function (string $id, string $fichier, bool $visible = true): void {
        C::comme($this, $this->scene['owner']);
        $this->patchJson(C::url($this->org, "/interventions/{$id}/files/{$fichier}"), ['visible_to_owner' => $visible])->assertOk();
    };
    $this->soumettre = function (int $prix = 60000): array {
        $id = C::enDevis($this, $this->scene, $prix);
        $devis = (string) C::devis($this, $this->scene, $id, $prix)->assertCreated()->json('data.id');
        $this->postJson(C::url($this->org, "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();

        return [$id, $devis];
    };
});

it('liste et sert l\'intervention de l\'équipe avec prestataire désigné, devis soumis et demande d\'accord', function (): void {
    [$id, $devis] = ($this->soumettre)();

    $liste = R::lire($this, $this->awa, '/interventions')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $detail = R::lire($this, $this->awa, '/interventions/'.$id)->assertOk();

    expect($liste->json('data'))->toHaveCount(1)
        ->and($liste->json('data.0'))->toMatchArray(['id' => $id, 'status' => 'awaiting_approval', 'title' => 'Fuite sous l\'évier'])
        ->and($liste->json('data.0.agency'))->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($liste->json('data.0.place.unit_reference'))->toBe($this->scene['unit']->reference)
        ->and($liste->json('data.0.supplier'))->toBe(['name' => $this->scene['supplier']->display_name])
        ->and($liste->json('data.0'))->not->toHaveKey('quotes')
        ->and($detail->json('data.description'))->toBe('De l\'eau coule sous l\'évier.')
        ->and($detail->json('data.quotes'))->toHaveCount(1)
        ->and($detail->json('data.quotes.0.id'))->toBe($devis)
        ->and($detail->json('data.quotes.0.total_gross'))->toBe(['amount' => 72000, 'currency' => 'EUR'])
        ->and($detail->json('data.quotes.0.lines.0.label'))->toBe('Réparation du siphon')
        ->and($detail->json('data.approvals'))->toHaveCount(1)
        ->and($detail->json('data.approvals.0'))->toMatchArray(['status' => 'pending', 'quote_id' => $devis, 'decided_via' => null])
        ->and($detail->json('data.approvals.0.ceiling_amount.amount'))->toBe(50000);
});

it('ne sert aucune donnée interne ni coordonnée du prestataire', function (): void {
    [$id] = ($this->soumettre)();
    L::dans($this->org, fn () => Intervention::query()->whereKey($id)->update([
        'custom_fields' => json_encode(['k' => 'CHAMP-PERSO']), 'completion_note' => 'NOTE-DE-FIN', 'decline_note' => 'NOTE-REFUS',
    ]));

    $texte = R::texte(R::lire($this, $this->awa, '/interventions/'.$id)->assertOk());

    foreach (['CHAMP-PERSO', 'NOTE-DE-FIN', 'NOTE-REFUS', 'idempotency', 'reporter', 'lease_id', 'mandant_party_id', 'supplier_party_id', 'stored_file', 'proof_file', 'decided_by', 'decider', 'email', 'phone'] as $interdit) {
        expect($texte)->not->toContain($interdit);
    }
    expect($texte)->not->toContain($this->scene['tenantParty']->id)->and($texte)->not->toContain($this->scene['supplier']->id);
});

it('ne sert la version et l\'empreinte que sur les demandes d\'accord, jamais sur l\'intervention ni les devis', function (): void {
    [$id] = ($this->soumettre)();
    $donnees = R::lire($this, $this->awa, '/interventions/'.$id)->assertOk()->json('data');

    expect($donnees)->not->toHaveKey('lock_version')->and($donnees['quotes'][0])->not->toHaveKey('lock_version')->not->toHaveKey('fingerprint')
        ->and($donnees['approvals'][0])->toHaveKeys(['lock_version', 'quote_fingerprint', 'statement_version'])
        ->and(substr_count(R::texte(R::lire($this, $this->awa, '/interventions/'.$id)), 'ingerprint'))->toBe(1);
});

it('n\'expose jamais le texte libre ni l\'identité du locataire, et masque le signalement non qualifié', function (): void {
    $id = C::signaler($this, $this->scene, ['description' => 'SECRET-DU-LOCATAIRE', 'room' => 'CHAMBRE-SECRETE', 'availability' => 'DISPO-SECRETE'])->assertCreated()->json('data.id');
    R::lire($this, $this->awa, '/interventions')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $this->awa, '/interventions/'.$id)->assertNotFound()->assertJsonPath('code', 'owner_intervention_not_found');

    C::enDevisPour($this, $this->scene, $id);
    L::dans($this->org, fn () => DB::table('intervention_events')->insert([
        'id' => fake()->uuid(), 'organization_id' => $this->org->id, 'intervention_id' => $id, 'kind' => 'comment', 'actor_kind' => 'tenant',
        'text' => 'COMMENTAIRE-LOCATAIRE', 'visible_to_owner' => true, 'visible_to_tenant' => true, 'created_at' => now()->format('Y-m-d H:i:s.u'),
    ]));

    $detail = R::lire($this, $this->awa, '/interventions/'.$id)->assertOk();
    $texte = R::texte($detail);

    expect($detail->json('data.title'))->not->toBe('Fuite sous l\'évier')->and($detail->json('data.description'))->toBeNull()
        ->and($detail->json('data.events'))->not->toBeEmpty()
        ->and(collect($detail->json('data.events'))->where('author', 'tenant')->count())->toBe(1)
        ->and(collect($detail->json('data.events'))->where('author', 'tenant')->pluck('text')->filter()->all())->toBe([])
        ->and($texte)->not->toContain('SECRET-DU-LOCATAIRE')->and($texte)->not->toContain('CHAMBRE-SECRETE')->and($texte)->not->toContain('DISPO-SECRETE')
        ->and($texte)->not->toContain('COMMENTAIRE-LOCATAIRE')->and($texte)->not->toContain($this->scene['tenantParty']->display_name);
});

it('masque une intervention classée sans suite ou non qualifiée, même rattachée au mandant', function (): void {
    $id = C::enDevis($this, $this->scene, 20000);
    R::lire($this, $this->awa, '/interventions/'.$id)->assertOk();

    foreach (['reported', 'declined'] as $statut) {
        L::dans($this->org, fn () => DB::table('interventions')->where('id', $id)->update(['status' => $statut]));
        R::lire($this, $this->awa, '/interventions')->assertOk()->assertJsonCount(0, 'data');
        R::lire($this, $this->awa, '/interventions/'.$id)->assertNotFound();
    }
});

it('masque le devis seulement reçu, jusqu\'à sa soumission au mandant', function (): void {
    $id = C::enDevis($this, $this->scene, 20000);
    $devis = (string) C::devis($this, $this->scene, $id, 20000)->assertCreated()->json('data.id');

    expect(R::lire($this, $this->awa, '/interventions/'.$id)->assertOk()->json('data.quotes'))->toBe([]);

    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->org, "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    expect(collect(R::lire($this, $this->awa, '/interventions/'.$id)->json('data.quotes'))->pluck('id')->all())->toBe([$devis]);
});

it('ne sert que les fichiers partagés, et refuse les autres, ceux d\'une autre intervention et les identifiants inconnus', function (): void {
    [$id] = ($this->soumettre)();
    [$autreId] = [C::enDevis($this, $this->scene, 20000)];
    $partage = C::fichier($this, $this->scene, $id, 'other');
    $prive = C::fichier($this, $this->scene, $id, 'other');
    $autreFichier = C::fichier($this, $this->scene, $autreId, 'other');
    ($this->partager)($id, $partage);
    ($this->partager)($autreId, $autreFichier);

    $fichiers = collect(R::lire($this, $this->awa, '/interventions/'.$id)->assertOk()->json('data.files'))->pluck('id')->all();
    $pdf = R::lire($this, $this->awa, '/interventions/'.$id.'/files/'.$partage)->assertOk();

    expect($fichiers)->toContain($partage)->not->toContain($prive)
        ->and($pdf->headers->get('Content-Type'))->toContain('pdf')->and($pdf->headers->get('Cache-Control'))->toContain('no-store');
    R::lire($this, $this->awa, '/interventions/'.$id.'/files/'.$prive)->assertNotFound()->assertJsonPath('code', 'owner_intervention_file_not_found');
    R::lire($this, $this->awa, '/interventions/'.$id.'/files/'.$autreFichier)->assertNotFound();
    R::lire($this, $this->awa, '/interventions/'.$id.'/files/'.fake()->uuid())->assertNotFound();

    ($this->partager)($id, $partage, false);
    R::lire($this, $this->awa, '/interventions/'.$id.'/files/'.$partage)->assertNotFound();
});

it('sert les factures reçues adressées au mandant et leurs seules imputations au propriétaire', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    $facture = C::facture($this, $this->scene, $id)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/interventions/{$id}/invoices/{$facture}/allocations"), ['target' => 'owner', 'share_amount' => 24000, 'idempotency_key' => 'imputation-lecture'])->assertCreated();

    $detail = R::lire($this, $this->awa, '/interventions/'.$id)->assertOk();

    expect($detail->json('data.invoices'))->toHaveCount(1)
        ->and($detail->json('data.invoices.0.id'))->toBe($facture)
        ->and($detail->json('data.invoices.0.total_gross'))->toBe(['amount' => 24000, 'currency' => 'EUR'])
        ->and($detail->json('data.allocations'))->toHaveCount(1)
        ->and($detail->json('data.allocations.0.charged_amount'))->toBe(['amount' => 24000, 'currency' => 'EUR'])
        ->and(R::texte($detail))->not->toContain('exceeds_approved')->and(R::texte($detail))->not->toContain('fingerprint')->and(R::texte($detail))->not->toContain('ledger');
});

it('cloisonne par mandant et par organisation : un autre propriétaire, une copie dans une autre agence', function (): void {
    [$id] = ($this->soumettre)();
    $bob = X::rattacher($this->org, T::partie($this->org, ['display_name' => 'Bob Autre']), 'bob@exemple.fr');
    $autre = T::organisation('Immo Loire');
    $lui = R::proprietaire($autre, 'loire@exemple.fr');
    $copie = [...(array) L::dans($this->org, fn () => DB::table('interventions')->where('id', $id)->first()), 'id' => fake()->uuid(), 'organization_id' => $autre->id, 'reference' => 'INT-2026-0001', 'idempotency_key' => fake()->uuid()];
    L::dans($autre, fn () => DB::table('interventions')->insert($copie));
    L::dans($autre, fn () => $lui['access']->forceFill(['user_id' => $this->awa->id])->save());

    expect(collect(R::lire($this, $this->awa, '/interventions')->assertOk()->json('data'))->pluck('id')->all())->toBe([$id]);
    R::lire($this, $this->awa, '/interventions/'.$copie['id'])->assertNotFound();
    R::lire($this, $bob, '/interventions')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $bob, '/interventions/'.$id)->assertNotFound();
    R::lire($this, $bob, '/interventions/'.$id.'/files/'.fake()->uuid())->assertNotFound();
    R::lire($this, $this->awa, '/interventions/'.fake()->uuid())->assertNotFound();
});

it('restreint par ?agency=, pagine par curseur et lit en nombre de requêtes constant', function (): void {
    [$id] = ($this->soumettre)();
    R::lire($this, $this->awa, '/interventions?agency='.$this->org->id)->assertOk()->assertJsonCount(1, 'data');
    R::lire($this, $this->awa, '/interventions?agency='.T::organisation('Tiers')->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
    $un = R::requetes($this, $this->awa, '/interventions');
    $detailUn = R::requetes($this, $this->awa, '/interventions/'.$id);

    foreach (range(1, 3) as $i) {
        C::enDevis($this, $this->scene, 20000);
    }

    $vus = [];
    $url = '/interventions?per_page=2';

    do {
        $page = R::lire($this, $this->awa, $url)->assertOk();
        $vus = [...$vus, ...collect($page->json('data'))->pluck('id')->all()];
        $curseur = $page->json('meta.next_cursor');
        $url = '/interventions?per_page=2&cursor='.$curseur;
    } while ($curseur !== null);

    expect($vus)->toHaveCount(4)->and(array_unique($vus))->toHaveCount(4)
        ->and(R::requetes($this, $this->awa, '/interventions'))->toBe($un)
        ->and(R::requetes($this, $this->awa, '/interventions/'.$id))->toBe($detailUn);
    R::lire($this, $this->awa, '/interventions?cursor=n-importe-quoi')->assertUnprocessable();
});

it('exige une session et un profil propriétaire pour les interventions', function (): void {
    [$id] = ($this->soumettre)();
    $partage = C::fichier($this, $this->scene, $id, 'other');

    foreach (['/interventions', '/interventions/'.$id, '/interventions/'.$id.'/files/'.$partage] as $chemin) {
        O::comme($this, null)->getJson('/api/v1/owner'.$chemin)->assertUnauthorized();
        R::lire($this, User::factory()->create(), $chemin)->assertForbidden();
        R::lire($this, $this->scene['tenant'], $chemin)->assertForbidden();
        R::lire($this, $this->scene['owner'], $chemin)->assertForbidden();
    }
});

it('ne sert pas le motif d\'urgence, et le commentaire d\'une demande d\'accord seulement s\'il vient du mandant', function (): void {
    [$id] = ($this->soumettre)();
    L::dans($this->org, fn () => Intervention::query()->whereKey($id)->update(['approval_basis' => 'emergency', 'emergency_reason' => 'MOTIF-URGENCE-LOCATAIRE']));
    L::dans($this->org, fn () => DB::table('intervention_approvals')->where('intervention_id', $id)->update(['decided_via' => 'agency_recorded', 'comment' => 'COMMENTAIRE-AGENCE']));

    $agence = R::lire($this, $this->awa, '/interventions/'.$id)->assertOk();

    expect(R::texte($agence))->not->toContain('MOTIF-URGENCE-LOCATAIRE')->not->toContain('COMMENTAIRE-AGENCE')
        ->and($agence->json('data.emergency_reason'))->toBeNull()
        ->and($agence->json('data.approval_basis'))->toBe('emergency')
        ->and($agence->json('data.approvals.0.comment'))->toBeNull();

    L::dans($this->org, fn () => DB::table('intervention_approvals')->where('intervention_id', $id)->update(['decided_via' => 'owner_space', 'comment' => 'COMMENTAIRE-MANDANT']));

    expect(R::lire($this, $this->awa, '/interventions/'.$id)->assertOk()->json('data.approvals.0.comment'))->toBe('COMMENTAIRE-MANDANT');
});
