<?php

declare(strict_types=1);

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Actions\SendCampaignDeliveries;
use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Jobs\DeliverCampaignBatch;
use App\Modules\Notifications\Mail\CampaignMail;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignAttachment;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Models\MailSuppression;
use App\Modules\Notifications\Queries\Campaigns;
use App\Modules\Notifications\Support\UnsubscribeToken;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
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
    $this->locataire = C::locataire($this->org, 'koffi@exemple.fr');
    $this->autre = C::locataire($this->org, 'ama@exemple.fr');
});

function programmer(object $test, string $id, int $minutes = 60): void
{
    C::appeler($test, $test->org, $test->titulaire, 'POST', "/{$id}/schedule", ['scheduled_at' => now()->addMinutes($minutes)->toIso8601String()], true)->assertOk();
}

function statut(object $test, string $id): string
{
    return L::dans($test->org, fn (): string => Campaign::query()->findOrFail($id)->status->value);
}

it('envoie une diffusion programmée à l\'heure dite, une seule fois', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    programmer($this, $id);

    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();
    expect(statut($this, $id))->toBe('scheduled');
    Mail::assertNothingSent();

    $this->travelTo(now()->addMinutes(61));
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();

    expect(statut($this, $id))->toBe('sent');
    Mail::assertSent(CampaignMail::class, 2);
});

it('n\'envoie pas une diffusion annulée avant l\'heure', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    programmer($this, $id);
    C::appeler($this, $this->org, $this->titulaire, 'POST', "/{$id}/cancel")->assertOk();

    $this->travelTo(now()->addHours(2));
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();

    expect(statut($this, $id))->toBe('cancelled');
    Mail::assertNothingSent();
});

it('laisse une diffusion programmée en l\'état quand le plafond est atteint, sans envoi hors plafond', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    programmer($this, $id);
    config(['notifications.campaigns.daily_recipients' => 1]);

    $this->travelTo(now()->addMinutes(61));
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();

    expect(statut($this, $id))->toBe('scheduled');
    Mail::assertNothingSent();

    config(['notifications.campaigns.daily_recipients' => 2000]);
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();
    expect(statut($this, $id))->toBe('sent');
});

it('découpe l\'envoi en paquets et ne perd aucune ligne', function (): void {
    Queue::fake();
    config(['notifications.campaigns.batch_size' => 1]);
    $id = C::creer($this, $this->org, $this->titulaire);

    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk()->assertJsonPath('data.status', 'sending')->assertJsonPath('data.metrics.queued', 2);

    Queue::assertPushed(DeliverCampaignBatch::class, 2);
    Mail::assertNothingSent();

    $paquets = Queue::pushed(DeliverCampaignBatch::class)->map(fn (DeliverCampaignBatch $job): array => $job->deliveryIds)->flatten()->sort()->values()->all();
    expect($paquets)->toBe(C::envois($this->org, $id)->pluck('id')->sort()->values()->all());

    foreach (Queue::pushed(DeliverCampaignBatch::class) as $job) {
        $job->handle(app(CurrentOrganization::class), app(SendCampaignDeliveries::class));
    }

    expect(statut($this, $id))->toBe('sent');
    Mail::assertSent(CampaignMail::class, 2);
});

it('relance les paquets perdus sans jamais renvoyer une ligne déjà partie', function (): void {
    Queue::fake();
    $id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();

    $this->travelTo(now()->addMinutes(31));
    $this->artisan('notifications:resume-campaigns')->assertSuccessful();
    Queue::assertPushed(DeliverCampaignBatch::class, 2);

    foreach (Queue::pushed(DeliverCampaignBatch::class) as $job) {
        $job->handle(app(CurrentOrganization::class), app(SendCampaignDeliveries::class));
    }

    Mail::assertSent(CampaignMail::class, 2);
});

it('marque inconnue, sans la renvoyer, une ligne restée en cours d\'envoi', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
    Mail::fake();

    $perdue = C::envois($this->org, $id)->first();
    L::dans($this->org, function () use ($perdue, $id): void {
        CampaignDelivery::query()->whereKey($perdue->id)->update(['status' => 'sending', 'attempted_at' => now()->subMinutes(5)->format('Y-m-d H:i:s.u')]);
        Campaign::query()->whereKey($id)->update(['status' => 'sending', 'sent_at' => null]);
    });

    $this->artisan('notifications:resume-campaigns')->assertSuccessful();
    expect(statut($this, $id))->toBe('sending');

    $this->travelTo(now()->addMinutes(31));
    $this->artisan('notifications:resume-campaigns')->assertSuccessful();
    $this->artisan('notifications:resume-campaigns')->assertSuccessful();

    expect(C::envois($this->org, $id)->firstWhere('id', $perdue->id)->status->value)->toBe('unknown')
        ->and(statut($this, $id))->toBe('sent');
    Mail::assertNothingSent();
    C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$id}")->assertJsonPath('data.metrics.unknown', 1)->assertJsonPath('data.failed_count', 1);
});

it('refuse un second envoi simultané quand le verrou du plafond est tenu', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    $this->travelBack();
    $verrou = Cache::lock('campaigns:quota:'.$this->org->id, 60);
    expect($verrou->get())->toBeTrue();

    C::envoyer($this, $this->org, $this->titulaire, $id)->assertStatus(429)->assertHeader('Retry-After', '5');

    expect(statut($this, $id))->toBe('draft');
    Mail::assertNothingSent();
    $verrou->release();
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
});

it('ne laisse pas une valeur de fusion injecter un en-tête, du HTML ou un autre champ', function (): void {
    L::dans($this->org, fn () => $this->locataire['party']->forceFill(['first_name' => "Koffi\r\nBcc: pirate@exemple.fr <b>{{ Bien }}"])->save());
    $id = C::creer($this, $this->org, $this->titulaire, ['subject' => 'Bonjour {Prénom}', 'body' => 'Bonjour {{ Prénom }}']);

    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();

    $courrier = Mail::sent(CampaignMail::class)->first(fn (CampaignMail $m): bool => $m->to[0]['address'] === 'koffi@exemple.fr');
    expect($courrier->objet)->not->toContain("\r")->not->toContain("\n")
        ->and($courrier->objet)->toContain('{{ Bien }}')
        ->and($courrier->hasBcc('pirate@exemple.fr'))->toBeFalse()
        ->and($courrier->render())->not->toContain('Residence');
});

it('efface le contenu après 3 ans et les adresses après 13 mois, sans supprimer la trace', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    O::navigateurAgence($this);
    O::comme($this, $this->titulaire);
    $this->post(C::url($this->org, "/{$id}/attachments"), ['file' => C::pdf()], ['Accept' => 'application/json'])->assertCreated();
    $fichier = L::dans($this->org, fn () => CampaignAttachment::query()->firstOrFail()->stored_file_id);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
    $empreintes = C::envois($this->org, $id)->pluck('email_hash')->sort()->values()->all();

    $this->travelTo(now()->addMonths(12));
    $this->artisan('notifications:purge-campaigns')->assertSuccessful();
    expect(C::envois($this->org, $id)->whereNotNull('email')->count())->toBe(2);

    $this->travelTo(now()->addMonths(2));
    $this->artisan('notifications:purge-campaigns')->assertSuccessful();
    $lignes = C::envois($this->org, $id);
    expect($lignes->whereNotNull('email')->count())->toBe(0)
        ->and($lignes->whereNotNull('merge_values')->count())->toBe(0)
        ->and($lignes->pluck('email_hash')->sort()->values()->all())->toBe($empreintes)
        ->and(L::dans($this->org, fn () => Campaign::query()->findOrFail($id)->content_purged_at))->toBeNull();

    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI)->addYears(3)->addDays(2));
    $this->artisan('notifications:purge-campaigns')->assertSuccessful();
    $this->artisan('notifications:purge-campaigns')->assertSuccessful();

    $campagne = L::dans($this->org, fn () => Campaign::query()->findOrFail($id));
    expect($campagne->subject)->toBe('[effacé]')->and($campagne->body)->toBe('[effacé]')->and($campagne->content_purged_at)->not->toBeNull()
        ->and($campagne->recipient_count)->toBe(2)->and($campagne->status->value)->toBe('sent')
        ->and(L::dans($this->org, fn () => app(DocumentStore::class)->find($fichier)))->toBeNull()
        ->and(L::dans($this->org, fn () => CampaignAttachment::query()->count()))->toBe(1)
        ->and(C::envois($this->org, $id))->toHaveCount(2);

    $vue = L::dans($this->org, fn (): array => (new CampaignResource(app(Campaigns::class)->find($id)))->toArray(request()));
    expect($vue['content_purged'])->toBeTrue()->and($vue['metrics']['sent'])->toBe(2);
});

it('garde la liste d\'opposition après la purge des adresses', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
    $this->postJson('/api/v1/mail/unsubscribe/'.app(UnsubscribeToken::class)->issue(C::envois($this->org, $id)->first()))->assertNoContent();

    $this->travelTo(now()->addMonths(14));
    $this->artisan('notifications:purge-campaigns')->assertSuccessful();

    expect(MailSuppression::query()->count())->toBe(1);
});

it('lit une page de diffusions en un nombre constant de requêtes', function (): void {
    $compter = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        C::appeler($this, $this->org, $this->titulaire, 'GET')->assertOk();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    };

    C::creer($this, $this->org, $this->titulaire, ['subject' => 'Une']);
    $une = $compter();

    foreach (range(2, 8) as $n) {
        C::creer($this, $this->org, $this->titulaire, ['subject' => "Diffusion {$n}"]);
    }

    expect($compter())->toBe($une);
});

it('purge le contenu d\'une diffusion dont la pièce a été ajoutée longtemps après sa création', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    O::navigateurAgence($this);
    O::comme($this, $this->titulaire);
    $this->post(C::url($this->org, "/{$id}/attachments"), ['file' => C::pdf()], ['Accept' => 'application/json'])->assertCreated();
    $fichier = L::dans($this->org, fn () => CampaignAttachment::query()->firstOrFail()->stored_file_id);
    DB::table('stored_files')->where('id', $fichier)->update(['retention_until' => CarbonImmutable::parse(C::AUJOURDHUI)->addYears(3)->addMonths(10)]);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();

    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI)->addYears(3)->addDays(2));
    $this->artisan('notifications:purge-campaigns')->assertSuccessful();

    expect(L::dans($this->org, fn () => Campaign::query()->findOrFail($id)->content_purged_at))->not->toBeNull()
        ->and(L::dans($this->org, fn () => app(DocumentStore::class)->find($fichier)))->toBeNull();
});

it('efface les adresses même quand la purge du contenu d\'une diffusion échoue, et poursuit avec les autres', function (): void {
    $bloquee = C::creer($this, $this->org, $this->titulaire, ['subject' => 'Bloquée']);
    O::navigateurAgence($this);
    O::comme($this, $this->titulaire);
    $this->post(C::url($this->org, "/{$bloquee}/attachments"), ['file' => C::pdf()], ['Accept' => 'application/json'])->assertCreated();
    $fichier = L::dans($this->org, fn () => CampaignAttachment::query()->firstOrFail()->stored_file_id);
    DB::table('stored_files')->where('id', $fichier)->update(['subject_type' => 'organization', 'subject_id' => $this->org->id]);
    $saine = C::creer($this, $this->org, $this->titulaire, ['subject' => 'Saine']);
    C::envoyer($this, $this->org, $this->titulaire, $saine)->assertOk();

    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI)->addYears(3)->addDays(2));
    $this->artisan('notifications:purge-campaigns')->assertFailed();

    expect(C::envois($this->org, $saine)->whereNotNull('email')->count())->toBe(0)
        ->and(L::dans($this->org, fn () => Campaign::query()->findOrFail($saine)->content_purged_at))->not->toBeNull()
        ->and(L::dans($this->org, fn () => Campaign::query()->findOrFail($bloquee)->content_purged_at))->toBeNull();
});

it('ne démarre pas une diffusion programmée dont l\'auteur n\'a plus le droit d\'envoyer, la journalise sans donnée personnelle, puis la lance au retour du droit', function (string $table, array $perdu, array $retrouve): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    programmer($this, $id);
    $requete = fn () => $table === 'users'
        ? DB::table('users')->where('id', $this->titulaire->id)
        : DB::table('organization_members')->where('user_id', $this->titulaire->id)->where('organization_id', $this->org->id);

    $requete()->update($perdu);
    $this->travelTo(now()->addMinutes(61));
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();

    $journal = DB::table('audit_logs')->where('action', 'notifications.campaign.start_blocked')->get();
    expect(statut($this, $id))->toBe('scheduled')
        ->and(C::envois($this->org, $id))->toHaveCount(0)
        ->and($journal)->toHaveCount(1)
        ->and((string) json_encode($journal->all()))->not->toContain('@');
    Mail::assertNothingSent();

    $requete()->update($retrouve);
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();

    expect(statut($this, $id))->toBe('sent');
    Mail::assertSent(CampaignMail::class, 2);
})->with([
    'rôle comptable' => ['organization_members', ['role' => 'accountant'], ['role' => 'owner']],
    'membre désactivé' => ['organization_members', ['status' => 'disabled'], ['status' => 'active']],
    'double authentification retirée' => ['users', ['two_factor_confirmed_at' => null], ['two_factor_confirmed_at' => '2026-01-01 00:00:00']],
]);
