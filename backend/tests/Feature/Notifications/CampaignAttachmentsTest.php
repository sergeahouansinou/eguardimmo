<?php

declare(strict_types=1);

use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Mail\CampaignMail;
use App\Modules\Notifications\Models\CampaignAttachment;
use App\Modules\Notifications\Models\CampaignDelivery;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\CampaignsContext as C;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    Mail::fake();
    L::semer();
    C::fournisseur();
    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->id = C::creer($this, $this->org, $this->titulaire);
});

function televerser(object $test, string $campagne, UploadedFile $fichier, $compte = null): TestResponse
{
    O::navigateurAgence($test);
    O::comme($test, $compte ?? $test->titulaire);

    return $test->post(C::url($test->org, "/{$campagne}/attachments"), ['file' => $fichier], ['Accept' => 'application/json']);
}

it('ajoute, télécharge puis retire une pièce PDF d\'un brouillon', function (): void {
    $cree = televerser($this, $this->id, C::pdf('Avis de coupure.pdf'))->assertCreated()->assertJsonPath('data.name', 'Avis de coupure.pdf');
    $piece = $cree->json('data.id');

    C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$this->id}")->assertOk()->assertJsonPath('data.attachments.0.id', $piece)->assertJsonPath('data.attachments.0.name', 'Avis de coupure.pdf');

    $reponse = C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$this->id}/attachments/{$piece}")->assertOk();
    expect($reponse->streamedContent())->toBe("%PDF-1.4\n% avis aux locataires\n")
        ->and($reponse->headers->get('Cache-Control'))->toContain('private');

    $fichierId = CampaignAttachment::query()->findOrFail($piece)->stored_file_id;

    C::appeler($this, $this->org, $this->titulaire, 'DELETE', "/{$this->id}/attachments/{$piece}")->assertNoContent();
    expect(CampaignAttachment::query()->count())->toBe(0)
        ->and(L::dans($this->org, fn () => app(DocumentStore::class)->find($fichierId)))->toBeNull();
    C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$this->id}/attachments/{$piece}")->assertNotFound()->assertJsonPath('code', 'campaign_attachment_not_found');
    C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$this->id}")->assertJsonPath('data.attachments', []);
});

it('conserve la pièce trois ans comme la diffusion', function (): void {
    televerser($this, $this->id, C::pdf())->assertCreated();

    $fichier = L::dans($this->org, fn () => app(DocumentStore::class)->find(CampaignAttachment::query()->firstOrFail()->stored_file_id));

    expect($fichier->retentionUntil?->toDateString())->toBe(now()->addYears(3)->toDateString());
});

it('refuse plus de trois pièces, un fichier qui n\'est pas un PDF et un fichier trop lourd', function (): void {
    foreach ([1, 2, 3] as $n) {
        televerser($this, $this->id, C::pdf("avis-{$n}.pdf"))->assertCreated();
    }

    televerser($this, $this->id, C::pdf('quatre.pdf'))->assertStatus(409)->assertJsonPath('code', 'campaign_attachment_limit');

    $autre = C::creer($this, $this->org, $this->titulaire, ['subject' => 'Autre']);
    televerser($this, $autre, UploadedFile::fake()->createWithContent('faux.pdf', '<?php echo 1;'))->assertUnprocessable();
    televerser($this, $autre, UploadedFile::fake()->image('photo.png'))->assertUnprocessable();
    televerser($this, $autre, UploadedFile::fake()->create('lourd.pdf', 6000, 'application/pdf'))->assertUnprocessable();

    expect(CampaignAttachment::query()->count())->toBe(3);
});

it('ne modifie plus les pièces d\'une diffusion qui n\'est plus un brouillon', function (): void {
    $piece = televerser($this, $this->id, C::pdf())->assertCreated()->json('data.id');
    C::locataire($this->org, 'koffi@exemple.fr');
    C::envoyer($this, $this->org, $this->titulaire, $this->id)->assertOk();

    televerser($this, $this->id, C::pdf('tardive.pdf'))->assertStatus(409)->assertJsonPath('code', 'campaign_not_editable');
    C::appeler($this, $this->org, $this->titulaire, 'DELETE', "/{$this->id}/attachments/{$piece}")->assertStatus(409)->assertJsonPath('code', 'campaign_not_editable');
});

it('envoie la pièce en pièce jointe à une fiche sans compte et par lien à un compte', function (): void {
    televerser($this, $this->id, C::pdf('Avis.pdf'))->assertCreated();
    $compte = C::locataire($this->org, 'koffi@exemple.fr');
    $fiche = T::colocataire($this->org, $compte['lease']);
    T::emailPrincipal($this->org, $fiche, 'fiche@exemple.fr');

    C::envoyer($this, $this->org, $this->titulaire, $this->id)->assertOk()->assertJsonPath('data.metrics.sent', 2);

    $pourCompte = Mail::sent(CampaignMail::class)->first(fn (CampaignMail $m): bool => $m->to[0]['address'] === 'koffi@exemple.fr');
    $pourFiche = Mail::sent(CampaignMail::class)->first(fn (CampaignMail $m): bool => $m->to[0]['address'] === 'fiche@exemple.fr');

    expect($pourCompte->pieces)->toBe([])->and($pourCompte->piecesEnLien)->toBe(1)
        ->and($pourCompte->render())->toContain('https://locataire.eguardimmo.test/annonces/'.$this->id)
        ->and($pourFiche->pieces)->toHaveCount(1)->and($pourFiche->pieces[0]['name'])->toBe('Avis.pdf')
        ->and($pourFiche->pieces[0]['contents'])->toBe("%PDF-1.4\n% avis aux locataires\n")
        ->and($pourFiche->piecesEnLien)->toBe(0);
});

it('bloque l\'envoi tant qu\'une pièce n\'est pas saine, et ne crée aucune ligne d\'envoi', function (): void {
    televerser($this, $this->id, C::pdf('Avis.pdf'))->assertCreated();
    C::locataire($this->org, 'koffi@exemple.fr');
    $fichier = CampaignAttachment::query()->firstOrFail()->stored_file_id;

    foreach (['pending', 'unverifiable', 'infected'] as $statut) {
        L::dans($this->org, fn () => StoredFile::query()->whereKey($fichier)->update(['scan_status' => $statut]));

        C::envoyer($this, $this->org, $this->titulaire, $this->id)->assertStatus(409)->assertJsonPath('code', 'campaign_attachment_not_ready');
        expect(CampaignDelivery::query()->count())->toBe(0);
    }

    L::dans($this->org, fn () => StoredFile::query()->whereKey($fichier)->update(['scan_status' => 'clean']));

    C::envoyer($this, $this->org, $this->titulaire, $this->id)->assertOk()->assertJsonPath('data.metrics.sent', 1);
    Mail::assertSentCount(1);
});
