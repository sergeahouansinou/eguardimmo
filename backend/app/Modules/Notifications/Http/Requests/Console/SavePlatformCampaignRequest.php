<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests\Console;

use App\Modules\Notifications\Data\PlatformCampaignDraft;
use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\MarketingCategory;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Support\CampaignHtml;
use App\Modules\Notifications\Support\CampaignImageFiles;
use App\Modules\Notifications\Support\MarketingOptions;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class SavePlatformCampaignRequest extends FormRequest
{
    private const string SINGLE_LINE = 'not_regex:/[\x00-\x1F\x7F]/';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        $email = 'exclude_unless:channel,'.MarketingChannel::Email->value;
        $push = 'exclude_unless:channel,'.MarketingChannel::Push->value;
        $choisis = 'exclude_unless:audience,'.MarketingAudience::Selected->value;
        $regles = [
            'channel' => ['required', 'string', Rule::enum(MarketingChannel::class)],
            'category' => ['required', 'string', Rule::enum(MarketingCategory::class)],
            'audience' => ['required', 'string', Rule::enum(MarketingAudience::class)],
            'inactivity_days' => ['exclude_unless:audience,'.MarketingAudience::InactiveAccounts->value, 'required', 'integer', 'min:7', 'max:365'],
            'recipient_emails' => [$choisis, 'required', 'array', 'list', 'min:1', 'max:'.MarketingOptions::SELECTED_RECIPIENTS],
            'recipient_emails.*' => [$choisis, 'required', 'string', 'email:rfc', 'max:254'],
            'subject' => [$email, 'required', 'string', 'max:'.MarketingOptions::SUBJECT, self::SINGLE_LINE],
            'html' => [$email, 'required', 'string', $this->htmlSize()],
            'images' => [$email, 'array', 'max:'.CampaignImageFiles::MAX_IMAGES, $this->references()],
            'images.*' => [$email, 'file', $this->imageContent()],
            'push_title' => [$push, 'required', 'string', 'max:'.MarketingOptions::PUSH_TITLE, self::SINGLE_LINE],
            'push_body' => [$push, 'required', 'string', 'max:'.MarketingOptions::PUSH_BODY],
            'link' => [$push, 'nullable', 'string', 'max:255', 'regex:~^/(?!/)[^\\\\\s\x00-\x1F\x7F]*$~u'],
        ];

        if ($this->route('campaign') === null) {
            return $regles;
        }

        return [
            ...$regles,
            'lock_version' => ['required', 'integer', 'min:1'],
            'removed_image_ids' => [$email, 'array', 'list', 'max:'.CampaignImageFiles::MAX_IMAGES],
            'removed_image_ids.*' => [$email, 'required', 'uuid', 'distinct'],
        ];
    }

    public function toData(): PlatformCampaignDraft
    {
        $donnees = $this->validated();
        /** @var list<string> $adresses */
        $adresses = $donnees['recipient_emails'] ?? [];
        /** @var array<string, UploadedFile> $images */
        $images = $donnees['images'] ?? [];
        /** @var list<string> $retirees */
        $retirees = $donnees['removed_image_ids'] ?? [];
        $texte = fn (string $cle): ?string => isset($donnees[$cle]) ? (string) $donnees[$cle] : null;

        return new PlatformCampaignDraft(
            MarketingChannel::from((string) $donnees['channel']),
            MarketingCategory::from((string) $donnees['category']),
            MarketingAudience::from((string) $donnees['audience']),
            isset($donnees['inactivity_days']) ? (int) $donnees['inactivity_days'] : null,
            array_values(array_unique(array_map(fn (string $adresse): string => Str::lower(trim($adresse)), $adresses))),
            $texte('subject'),
            $texte('html'),
            $texte('push_title'),
            $texte('push_body'),
            $texte('link'),
            $images,
            array_map(fn (string $id): string => Str::lower($id), $retirees),
            isset($donnees['lock_version']) ? (int) $donnees['lock_version'] : null,
        );
    }

    private function htmlSize(): Closure
    {
        return function (string $attribut, mixed $valeur, Closure $echec): void {
            if (is_string($valeur) && strlen($valeur) > CampaignHtml::MAX_BYTES) {
                $echec('Le contenu dépasse 200 000 octets.');
            }
        };
    }

    private function references(): Closure
    {
        return function (string $attribut, mixed $valeur, Closure $echec): void {
            foreach (array_keys(is_array($valeur) ? $valeur : []) as $reference) {
                if (preg_match('/\A[a-z0-9-]{1,36}\z/', (string) $reference) !== 1) {
                    $echec('Une référence d\'image compte 1 à 36 lettres minuscules, chiffres ou tirets.');

                    return;
                }
            }
        };
    }

    private function imageContent(): Closure
    {
        return function (string $attribut, mixed $valeur, Closure $echec): void {
            $probleme = $valeur instanceof UploadedFile ? app(CampaignImageFiles::class)->problem($valeur) : null;

            if ($probleme !== null) {
                $echec($probleme);
            }
        };
    }
}
