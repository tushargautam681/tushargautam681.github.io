const username = 'tushargautam681'; // Replace with the desired GitHub username
const url = `https://api.github.com/users/${username}/repos`;

const projectContainer = document.querySelector('.all-projects'); // This is where projects will be displayed

fetch(url)
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok ' + response.statusText);
    }
    return response.json();
  })
  .then(data => {
    // Loop through each repository and create a project item
    data.forEach(repo => {
      const projectItem = document.createElement('div');
      projectItem.classList.add('project-item');

      const projectInfo = document.createElement('div');
      projectInfo.classList.add('project-info');
      
      // Repository title and description
      const repoTitle = document.createElement('h1');
      repoTitle.textContent = repo.name;
      const repoDesc = document.createElement('h2');
      repoDesc.textContent = repo.description || 'No description available';  // Default text if no description

      const repoLang = document.createElement('p');
      repoLang.textContent = `Language: ${repo.language || 'Not specified'}`;

      projectInfo.appendChild(repoTitle);
      projectInfo.appendChild(repoDesc);
      projectInfo.appendChild(repoLang);

      // Project image (You can use an image from the repo or a placeholder)
      const projectImg = document.createElement('div');
      projectImg.classList.add('project-img');
      const img = document.createElement('img');
      img.src = repo.owner.avatar_url; // Optional: display the user's avatar as a placeholder image for each project
      img.alt = `${repo.name} image`; // Alt text for the image
      projectImg.appendChild(img);

      // Append the project item to the project container
      projectItem.appendChild(projectInfo);
      projectItem.appendChild(projectImg);
      projectContainer.appendChild(projectItem);
    });
  })
  .catch(error => {
    console.error('There has been a problem with your fetch operation:', error);
  });
