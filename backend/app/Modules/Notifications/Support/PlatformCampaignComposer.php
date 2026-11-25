<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Data\PlatformCampaignDraft;
use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignImage;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Applique un brouillon validé à une campagne, sous la transaction de l'appelant.
 */
final readonly class PlatformCampaignComposer
{
    public function __construct(
        private PlatformRecipients $destinataires,
        private CampaignHtml $html,
        private CampaignImageFiles $fichiers,
    ) {}

    /**
     * @param  list<string>  $ecrits  complété au fil des écritures sur disque : l'appelant les efface si la transaction échoue
     * @return array{unknown: list<string>, removed: list<string>} adresses sans compte joignable ; fichiers à effacer après validation
     */
    public function apply(PlatformCampaign $campagne, PlatformCampaignDraft $brouillon, array &$ecrits): array
    {
        [$comptes, $inconnues] = $this->selection($brouillon);
        $email = $brouillon->channel === MarketingChannel::Email;
        $campagne->forceFill([
            'id' => $campagne->getKey() ?? (string) Str::uuid7(),
            'channel' => $brouillon->channel,
            'category' => $brouillon->category,
            'audience' => $brouillon->audience,
            'inactivity_days' => $brouillon->inactivityDays,
            'recipient_user_ids' => $comptes,
            'subject' => $email ? $brouillon->subject : null,
            'push_title' => $email ? null : $brouillon->pushTitle,
            'push_body' => $email ? null : $brouillon->pushBody,
            'link' => $email ? null : $brouillon->link,
            'html' => null,
        ]);

        if (! $email) {
            $campagne->save();

            return ['unknown' => $inconnues, 'removed' => []];
        }

        /** @var Collection<int, PlatformCampaignImage> $existantes */
        $existantes = $campagne->exists ? $campagne->images()->get() : new Collection;
        $retirees = $existantes->filter(fn (PlatformCampaignImage $image): bool => in_array($image->id, $brouillon->removedImageIds, true));

        if ($retirees->count() !== count($brouillon->removedImageIds)) {
            throw ValidationException::withMessages(['removed_image_ids' => 'Une image à retirer n\'appartient pas à cette campagne.']);
        }

        $conservees = $existantes->reject(fn (PlatformCampaignImage $image): bool => in_array($image->id, $brouillon->removedImageIds, true));
        $this->assertImageLimits($conservees, $brouillon);
        $nouvelles = array_map(fn (): string => (string) Str::uuid7(), $brouillon->images);
        $references = $nouvelles;

        foreach ($conservees as $image) {
            $references[$image->id] = $image->id;
        }

        $propre = $this->html->sanitize((string) $brouillon->html, $references);

        if ($propre === '' || ($this->html->toText($propre) === '' && $this->html->citedImages($propre) === [])) {
            throw ValidationException::withMessages(['html' => 'Le contenu est vide une fois les éléments non autorisés retirés.']);
        }

        $campagne->html = $propre;
        $campagne->save();

        foreach ($brouillon->images as $reference => $fichier) {
            $donnees = $this->fichiers->store($campagne->id, $nouvelles[$reference], $fichier);
            $ecrits[] = $donnees['path'];
            (new PlatformCampaignImage)->forceFill(['id' => $nouvelles[$reference], 'campaign_id' => $campagne->id, ...$donnees])->save();
        }

        $chemins = array_values($retirees->map(fn (PlatformCampaignImage $image): string => $image->path)->all());
        PlatformCampaignImage::query()->whereKey($retirees->modelKeys())->delete();

        return ['unknown' => $inconnues, 'removed' => $chemins];
    }

    /**
     * @return array{list<string>, list<string>} comptes retenus, adresses sans compte joignable
     */
    private function selection(PlatformCampaignDraft $brouillon): array
    {
        if ($brouillon->audience !== MarketingAudience::Selected) {
            return [[], []];
        }

        $candidats = array_values(User::query()->whereIn('email', $brouillon->recipientEmails)->pluck('id')->all());
        $trouves = [];

        foreach ($this->destinataires->reachable($candidats) as $compte) {
            $trouves[Str::lower($compte->email)] = $compte->id;
        }

        $inconnues = array_values(array_filter($brouillon->recipientEmails, fn (string $adresse): bool => ! isset($trouves[$adresse])));

        return [array_values(array_intersect_key($trouves, array_flip($brouillon->recipientEmails))), $inconnues];
    }

    /**
     * @param  Collection<int, PlatformCampaignImage>  $conservees
     */
    private function assertImageLimits(Collection $conservees, PlatformCampaignDraft $brouillon): void
    {
        if ($conservees->count() + count($brouillon->images) > CampaignImageFiles::MAX_IMAGES) {
            throw ValidationException::withMessages(['images' => 'Une campagne porte cinq images au plus.']);
        }

        $total = (int) $conservees->sum('size_bytes');

        foreach ($brouillon->images as $fichier) {
            $total += (int) $fichier->getSize();
        }

        if ($total > CampaignImageFiles::MAX_TOTAL_BYTES) {
            throw ValidationException::withMessages(['images' => 'Les images d\'une campagne pèsent 6 Mo au total au plus.']);
        }
    }
}
