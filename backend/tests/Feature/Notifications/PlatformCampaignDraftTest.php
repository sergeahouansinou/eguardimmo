<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignImage;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Console\ConsoleContext;
use Tests\Feature\Notifications\PlatformContext as P;

beforeEach(function (): void {
    Mail::fake();
    $this->operateur = P::preparer($this);
    $this->jeton = $this->operateur['jeton'];
});

it('annonce les canaux, les catégories, les groupes et les limites', function (): void {
    config(['notifications.push.driver' => 'none']);

    ConsoleContext::lire($this, $this->jeton, P::CONSOLE.'/marketing/options')->assertOk()
        ->assertJsonPath('data.channels.0', ['channel' => 'email', 'enabled' => true, 'reason' => null])
        ->assertJsonPath('data.channels.1.enabled', false)
        ->assertJsonPath('data.categories.0.code', 'marketing')
        ->assertJsonCount(8, 'data.audiences')
        ->assertJsonPath('data.audiences.6.accepts_inactivity_days', true)
        ->assertJsonPath('data.limits', ['subject' => 140, 'push_title' => 65, 'push_body' => 240, 'html_bytes' => 200000, 'images' => 5, 'image_bytes' => 2097152, 'total_image_bytes' => 6291456, 'selected_recipients' => 500]);
});

it('crée un brouillon avec ses images et réécrit les références', function (): void {
    $reponse = P::deposer($this, $this->jeton, P::URL, [
        ...P::email(['html' => '<p>Voici <img src="cid:logo" alt="Logo"></p><img src="cid:inconnu">']),
        'images' => ['logo' => P::png('Mon logo.png'), 'plaquette' => UploadedFile::fake()->image('plaquette.jpg', 8, 8)],
    ])->assertCreated()
        ->assertJsonPath('meta.unknown_recipients', [])
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.title', 'Nouveautés de novembre')
        ->assertJsonPath('data.audience_label', 'Tous les comptes')
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.recipient_count', 0)
        ->assertJsonPath('data.stats.queued', 0)
        ->assertJsonPath('data.stats.unsubscribed', 0)
        ->assertJsonCount(2, 'data.images');

    $images = collect($reponse->json('data.images'))->keyBy('name');
    $logo = $images['Mon logo.png'];
    $id = $reponse->json('data.id');

    expect($reponse->json('data.html'))->toContain('src="cid:'.$logo['id'].'"')->not->toContain('inconnu')->not->toContain('cid:logo')
        ->and($logo['inline'])->toBeTrue()
        ->and($images['plaquette.jpg']['inline'])->toBeFalse()
        ->and($logo['url'])->toBe("/api/v1/console/marketing/campaigns/{$id}/images/{$logo['id']}")
        ->and($logo['mime'])->toBe('image/png');

    $enregistree = PlatformCampaignImage::query()->findOrFail($logo['id']);
    Storage::disk('local')->assertExists($enregistree->path);
    expect($enregistree->path)->toBe("platform-campaigns/{$id}/{$logo['id']}.png");

    $image = ConsoleContext::lire($this, $this->jeton, $logo['url'])->assertOk()
        ->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Cache-Control', 'no-store, private');
    expect($image->getContent())->toBe(Storage::disk('local')->get($enregistree->path));

    $autre = P::creer($this, $this->jeton, P::email());
    ConsoleContext::lire($this, $this->jeton, P::URL."/{$autre}/images/{$logo['id']}")->assertNotFound();

    expect(AuditLog::query()->where('action', 'console.marketing.campaign_created')->count())->toBe(2);
});

it('assainit un HTML malveillant', function (): void {
    $html = '<h2 style="color:#123456">Titre</h2><script>alert(1)</script><style>p{}</style>'
        .'<p onclick="alert(1)" style="background:url(https://pisteur.test/p.gif)">A</p>'
        .'<p style="width:expression(alert(1))">B</p><p style="color:\72 ed">C</p>'
        .'<p style="background-image:image-set(\'https://pisteur.test/p.gif\' 1x)">D</p>'
        .'<a href="javascript:alert(1)">E</a><a href="http://clair.test">F</a><a href="/relatif">G</a>'
        .'<a href="mailto:bonjour@eguardimmo.com">H</a><a href="tel:+33100000000">I</a>'
        .'<img src="https://pisteur.test/pixel.gif"><img src="data:image/png;base64,AAAA"><iframe src="https://piege.test"></iframe>'
        .'<form action="https://piege.test"><input name="mdp"></form><svg onload="alert(1)"></svg>'
        .'<table cellpadding="4" background="https://pisteur.test/f.gif"><tr><td style="color: rgb(1, 2, 3)">J</td></tr></table>'
        .'<section><p>K</p></section>';

    $propre = ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL, P::email(['html' => $html]))->assertCreated()->json('data.html');

    expect($propre)->not->toContain('script')->not->toContain('onclick')->not->toContain('pisteur')->not->toContain('expression')
        ->not->toContain('<img')->not->toContain('iframe')->not->toContain('<form')->not->toContain('<input')->not->toContain('svg')
        ->not->toContain('javascript')->not->toContain('http://clair.test')->not->toContain('/relatif')->not->toContain('<section')
        ->toContain('style="color:#123456"')->toContain('mailto:bonjour')->toContain('tel:')->toContain('rgb(1, 2, 3)')->toContain('<p>K</p>');
});

it('garde un long contenu entier et refuse au-delà de 200 000 octets', function (): void {
    $long = '<p>'.str_repeat('a', 150000).'</p><p>fin</p>';

    expect(ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL, P::email(['html' => $long]))->assertCreated()->json('data.html'))->toEndWith('<p>fin</p>');
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL, P::email(['html' => '<p>'.str_repeat('a', 200000).'</p>']))->assertUnprocessable()->assertJsonValidationErrors('html');
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL, P::email(['html' => '<script>alert(1)</script>']))->assertUnprocessable()->assertJsonValidationErrors('html');
});

it('refuse une image invalide sans rien écrire', function (Closure $images): void {
    P::deposer($this, $this->jeton, P::URL, [...P::email(), 'images' => $images()])->assertUnprocessable();

    expect(PlatformCampaign::query()->count())->toBe(0)->and(Storage::disk('local')->allFiles())->toBe([]);
})->with([
    'texte renommé en image' => [fn (): array => ['a' => UploadedFile::fake()->createWithContent('a.png', '<?php echo 1;')]],
    'format refusé' => [fn (): array => ['a' => UploadedFile::fake()->createWithContent('a.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>')]],
    'trop lourde' => [fn (): array => ['a' => P::png()->size(2049)]],
    'six images' => [fn (): array => array_combine(['a', 'b', 'c', 'd', 'e', 'f'], array_map(fn (): UploadedFile => P::png(), range(1, 6)))],
    'référence interdite' => [fn (): array => ['Logo_1' => P::png()]],
    'dimensions démesurées' => [fn (): array => ['a' => UploadedFile::fake()->createWithContent('a.png', "\x89PNG\r\n\x1a\n".pack('N', 13).'IHDR'.pack('NN', 60000, 60000)."\x08\x02\x00\x00\x00".pack('N', 0))]],
]);

it('plafonne le poids total des images', function (): void {
    $lourde = function (): UploadedFile {
        $source = P::png();
        $png = (string) file_get_contents($source->getPathname());

        return UploadedFile::fake()->createWithContent('a.png', $png.str_repeat("\0", 1900000));
    };

    P::deposer($this, $this->jeton, P::URL, [...P::email(), 'images' => ['a' => $lourde(), 'b' => $lourde(), 'c' => $lourde(), 'd' => $lourde()]])
        ->assertUnprocessable()->assertJsonValidationErrors('images');

    expect(PlatformCampaign::query()->count())->toBe(0)->and(Storage::disk('local')->allFiles())->toBe([]);
});

it('valide les champs selon le canal et le groupe', function (array $corps, string $champ): void {
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL, $corps)->assertUnprocessable()->assertJsonValidationErrors($champ);
})->with([
    'objet absent' => [P::email(['subject' => null]), 'subject'],
    'objet sur deux lignes' => [P::email(['subject' => "A\r\nBcc: x@y.test"]), 'subject'],
    'titre push trop long' => [P::push(['push_title' => str_repeat('a', 66)]), 'push_title'],
    'lien externe' => [P::push(['link' => 'https://piege.test']), 'link'],
    'lien relatif au protocole' => [P::push(['link' => '//piege.test']), 'link'],
    'lien à barre inverse' => [P::push(['link' => '/\\piege.test']), 'link'],
    'inactivité absente' => [P::email(['audience' => 'inactive_accounts']), 'inactivity_days'],
    'inactivité trop courte' => [P::email(['audience' => 'inactive_accounts', 'inactivity_days' => 6]), 'inactivity_days'],
    'aucune adresse' => [P::email(['audience' => 'selected']), 'recipient_emails'],
    'trop d\'adresses' => [P::email(['audience' => 'selected', 'recipient_emails' => array_map(fn (int $n): string => "a{$n}@exemple.fr", range(1, 501))]), 'recipient_emails'],
    'groupe inconnu' => [P::email(['audience' => 'prospects']), 'audience'],
]);

it('ignore le statut, les compteurs et les champs de l\'autre canal envoyés par le client', function (): void {
    $id = P::creer($this, $this->jeton, [...P::push(), 'status' => 'sent', 'recipient_count' => 99, 'html' => '<p>x</p>', 'subject' => 'x', 'inactivity_days' => 3]);

    ConsoleContext::lire($this, $this->jeton, P::URL."/{$id}")->assertOk()
        ->assertJsonPath('data.status', 'draft')->assertJsonPath('data.recipient_count', 0)->assertJsonPath('data.html', null)
        ->assertJsonPath('data.subject', null)->assertJsonPath('data.inactivity_days', null)->assertJsonPath('data.link', '/notifications');
});

it('ne retient que les comptes joignables d\'une liste d\'adresses', function (): void {
    P::compte('awa@exemple.fr');
    P::compte('non-confirme@exemple.fr', ['email_verified_at' => null]);
    P::compte('suspendu@exemple.fr')->forceFill(['suspended_at' => now()])->save();
    P::compte('supprime@exemple.fr')->delete();

    $reponse = ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL, P::email([
        'audience' => 'selected',
        'recipient_emails' => ['AWA@exemple.fr', 'awa@exemple.fr', 'non-confirme@exemple.fr', 'suspendu@exemple.fr', 'supprime@exemple.fr', 'personne@exemple.fr'],
    ]))->assertCreated();

    expect($reponse->json('meta.unknown_recipients'))->toBe(['non-confirme@exemple.fr', 'suspendu@exemple.fr', 'supprime@exemple.fr', 'personne@exemple.fr'])
        ->and($reponse->json('data.recipient_emails'))->toBe(['awa@exemple.fr'])
        ->and(json_encode(AuditLog::query()->where('action', 'console.marketing.campaign_created')->firstOrFail()->getAttributes()))->not->toContain('exemple.fr');
});

it('modifie un brouillon sous contrôle de version et retire ses images', function (): void {
    $creee = P::deposer($this, $this->jeton, P::URL, [...P::email(['html' => '<p><img src="cid:logo"></p>']), 'images' => ['logo' => P::png()]])->assertCreated();
    $id = $creee->json('data.id');
    $image = PlatformCampaignImage::query()->firstOrFail();

    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}", P::email(['lock_version' => 1, 'subject' => 'Corrigé', 'html' => '<p>A <img src="cid:'.$image->id.'"></p>']))
        ->assertOk()->assertJsonPath('data.lock_version', 2)->assertJsonPath('data.title', 'Corrigé')->assertJsonPath('data.images.0.inline', true);

    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}", P::email(['lock_version' => 1]))->assertConflict()->assertJsonPath('code', 'platform_campaign_stale');
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}", P::push(['lock_version' => 2]))->assertUnprocessable()->assertJsonValidationErrors('channel');
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}", P::email(['lock_version' => 2, 'removed_image_ids' => [ConsoleContext::UUID_INCONNU]]))
        ->assertUnprocessable()->assertJsonValidationErrors('removed_image_ids');

    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}", P::email(['lock_version' => 2, 'removed_image_ids' => [$image->id], 'html' => '<p>A <img src="cid:'.$image->id.'"></p>']))
        ->assertOk()->assertJsonPath('data.images', [])->assertJsonPath('data.html', '<p>A </p>');

    Storage::disk('local')->assertMissing($image->path);
    expect(AuditLog::query()->where('action', 'console.marketing.campaign_updated')->count())->toBe(2);
});

it('liste les campagnes par pages, de la plus récente à la plus ancienne', function (): void {
    $premiere = P::creer($this, $this->jeton, P::email());
    $this->travel(1)->seconds();
    $seconde = P::creer($this, $this->jeton, P::push());

    $page = ConsoleContext::lire($this, $this->jeton, P::URL.'?per_page=1')->assertOk()
        ->assertJsonPath('data.0.id', $seconde)->assertJsonPath('data.0.title', 'Maintenance prévue')->assertJsonPath('meta.has_more', true);

    ConsoleContext::lire($this, $this->jeton, P::URL.'?per_page=1&cursor='.$page->json('meta.next_cursor'))
        ->assertJsonPath('data.0.id', $premiere)->assertJsonPath('meta.has_more', false)->assertJsonPath('meta.next_cursor', null);
    ConsoleContext::lire($this, $this->jeton, P::URL.'?status=sent')->assertJsonPath('data', []);
    ConsoleContext::lire($this, $this->jeton, P::URL.'?cursor=n-importe-quoi')->assertUnprocessable();
    ConsoleContext::lire($this, $this->jeton, P::URL.'?status=perdu')->assertUnprocessable();
});
